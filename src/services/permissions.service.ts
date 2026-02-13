import { RolesModels } from "../models/roles.model";
import {
    PermissionsModel,
    PermissionOverrideApprovalStatus,
    PermissionUpsertRow,
} from "../models/permissions.model";
import { UsersModels } from "../models/users.model";
import { AppError } from "../utils/AppError";
import { metrics } from "../utils/metrics";
import { invalidatePermissionDecisionCacheByUser, resolvePermissionDecisionWithCache } from "../utils/permissionCache";
import { normalizeRoleName } from "../utils/role";
import { runInTransaction } from "../database/dbContext";

type Scope = "none" | "own" | "branch" | "all";

type EffectivePermissionRow = {
    resourceKey: string;
    pageLabel: string;
    route: string;
    canAccess: boolean;
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    dataScope: Scope;
};

type ApprovalRiskFlag = "delete" | "all_scope";

const SCOPE_RANK: Record<Scope, number> = {
    none: 0,
    own: 1,
    branch: 2,
    all: 3,
};

export class PermissionsService {
    constructor(
        private permissionsModel: PermissionsModel,
        private rolesModel: RolesModels,
        private usersModel: UsersModels
    ) { }

    async getEffectiveByRoleId(roleId: string): Promise<{
        role: { id: string; roles_name: string; display_name: string };
        permissions: EffectivePermissionRow[];
    } | null> {
        const role = await this.rolesModel.findOne(roleId);
        if (!role) return null;

        const records = await this.permissionsModel.findRoleMatrix(roleId);
        const byResource = new Map<string, EffectivePermissionRow>();

        for (const record of records) {
            const existing = byResource.get(record.resource_key) ?? {
                resourceKey: record.resource_key,
                pageLabel: record.resource_name,
                route: record.route_pattern ?? "",
                canAccess: false,
                canView: false,
                canCreate: false,
                canUpdate: false,
                canDelete: false,
                dataScope: "none" as Scope,
            };

            const isAllowed = record.effect === "allow";
            const currentRank = SCOPE_RANK[existing.dataScope];
            const incomingScope = (record.scope ?? "none") as Scope;
            const incomingRank = isAllowed ? SCOPE_RANK[incomingScope] : 0;
            const nextScope = incomingRank > currentRank ? incomingScope : existing.dataScope;

            if (record.action_key === "access" && isAllowed) existing.canAccess = true;
            if (record.action_key === "view" && isAllowed) existing.canView = true;
            if (record.action_key === "create" && isAllowed) existing.canCreate = true;
            if (record.action_key === "update" && isAllowed) existing.canUpdate = true;
            if (record.action_key === "delete" && isAllowed) existing.canDelete = true;

            existing.dataScope = existing.canView ? nextScope : existing.dataScope;

            byResource.set(record.resource_key, existing);
        }

        return {
            role: {
                id: role.id,
                roles_name: role.roles_name,
                display_name: role.display_name,
            },
            permissions: Array.from(byResource.values()),
        };
    }

    async getEffectiveByUserId(userId: string): Promise<{
        user: { id: string; username: string; name?: string; roleId: string };
        role: { id: string; roles_name: string; display_name: string };
        permissions: EffectivePermissionRow[];
    } | null> {
        const user = await this.usersModel.findOne(userId);
        if (!user) return null;

        const roleId = user.roles_id;
        const roleEffective = await this.getEffectiveByRoleId(roleId);
        if (!roleEffective) return null;

        const overrideRecords = await this.permissionsModel.findUserOverrides(userId);
        const overrideMap = new Map<string, { effect: "allow" | "deny" | null; scope: Scope | null }>();
        for (const row of overrideRecords) {
            overrideMap.set(`${row.resource_key}:${row.action_key}`, {
                effect: row.effect,
                scope: (row.scope ?? "none") as Scope,
            });
        }

        const permissions = roleEffective.permissions.map((roleRow) => {
            const next: EffectivePermissionRow = { ...roleRow };
            const applyAction = (actionKey: "access" | "view" | "create" | "update" | "delete") => {
                const override = overrideMap.get(`${roleRow.resourceKey}:${actionKey}`);
                if (!override || !override.effect) return;
                const allowed = override.effect === "allow";
                if (actionKey === "access") next.canAccess = allowed;
                if (actionKey === "view") next.canView = allowed;
                if (actionKey === "create") next.canCreate = allowed;
                if (actionKey === "update") next.canUpdate = allowed;
                if (actionKey === "delete") next.canDelete = allowed;
                if (actionKey === "view") {
                    next.dataScope = allowed ? (override.scope ?? "none") : "none";
                }
            };

            applyAction("access");
            applyAction("view");
            applyAction("create");
            applyAction("update");
            applyAction("delete");

            if (!next.canView) {
                next.dataScope = "none";
            }

            return next;
        });

        return {
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                roleId: user.roles_id,
            },
            role: roleEffective.role,
            permissions,
        };
    }

    async replaceUserOverrides(userId: string, permissions: PermissionUpsertRow[], actorUserId: string, reason?: string): Promise<void> {
        try {
            const user = await this.usersModel.findOne(userId);
            if (!user) throw AppError.notFound("User");
            const before = await this.getEffectiveByUserId(userId);
            await this.permissionsModel.replaceUserOverrides(userId, permissions);
            await this.invalidateDecisionCacheSafely(userId);
            const after = await this.getEffectiveByUserId(userId);

            await this.permissionsModel.createPermissionAudit({
                actorUserId,
                targetType: "user",
                targetId: userId,
                actionType: "update_overrides",
                payloadBefore: before ? { permissions: before.permissions } : undefined,
                payloadAfter: after ? { permissions: after.permissions } : undefined,
                reason,
            });

            metrics.countPrivilegeEvent({
                event: "override_update",
                result: "success",
            });
        } catch (error) {
            metrics.countPrivilegeEvent({
                event: "override_update",
                result: "error",
            });
            throw error;
        }
    }

    async submitUserOverrideUpdate(input: {
        targetUserId: string;
        permissions: PermissionUpsertRow[];
        actorUserId: string;
        actorRoleName?: string;
        reason?: string;
    }): Promise<
        | { updated: true; approvalRequired: false }
        | {
            updated: false;
            approvalRequired: true;
            approvalRequest: {
                id: string;
                status: PermissionOverrideApprovalStatus;
                targetUserId: string;
                requestedByUserId: string;
                riskFlags: ApprovalRiskFlag[];
                createdAt: string;
            };
        }
    > {
        const user = await this.usersModel.findOne(input.targetUserId);
        if (!user) throw AppError.notFound("User");

        const riskFlags = this.collectApprovalRiskFlags(input.permissions);
        if (riskFlags.length === 0) {
            await this.replaceUserOverrides(input.targetUserId, input.permissions, input.actorUserId, input.reason);
            return { updated: true, approvalRequired: false };
        }

        this.assertAdminRole(input.actorRoleName, "Only Admin can submit high-risk permission changes");

        const approval = await this.permissionsModel.createOverrideApprovalRequest({
            targetUserId: input.targetUserId,
            requestedByUserId: input.actorUserId,
            reason: input.reason,
            riskFlags,
            permissionsPayload: input.permissions,
        });

        await this.permissionsModel.createPermissionAudit({
            actorUserId: input.actorUserId,
            targetType: "user",
            targetId: input.targetUserId,
            actionType: "override_update_request",
            payloadAfter: {
                approvalRequestId: approval.id,
                riskFlags,
                permissions: input.permissions,
            },
            reason: input.reason,
        });

        return {
            updated: false,
            approvalRequired: true,
            approvalRequest: {
                id: approval.id,
                status: approval.status,
                targetUserId: approval.target_user_id,
                requestedByUserId: approval.requested_by_user_id,
                riskFlags,
                createdAt: approval.created_at,
            },
        };
    }

    async getOverrideApprovals(params: {
        status?: PermissionOverrideApprovalStatus;
        targetUserId?: string;
        requestedByUserId?: string;
        page: number;
        limit: number;
    }): Promise<{ rows: any[]; total: number; page: number; limit: number }> {
        const page = Math.max(params.page, 1);
        const limit = Math.min(Math.max(params.limit, 1), 100);

        const result = await this.permissionsModel.findOverrideApprovals({
            status: params.status,
            targetUserId: params.targetUserId,
            requestedByUserId: params.requestedByUserId,
            page,
            limit,
        });

        return {
            rows: result.rows.map((row) => ({
                id: row.id,
                targetUserId: row.target_user_id,
                requestedByUserId: row.requested_by_user_id,
                reviewedByUserId: row.reviewed_by_user_id,
                status: row.status,
                reason: row.reason,
                reviewReason: row.review_reason,
                riskFlags: row.risk_flags,
                createdAt: row.created_at,
                reviewedAt: row.reviewed_at,
            })),
            total: result.total,
            page,
            limit,
        };
    }

    async reviewOverrideApproval(input: {
        approvalId: string;
        decision: "approved" | "rejected";
        approverUserId: string;
        approverRoleName?: string;
        reviewReason?: string;
    }): Promise<{
        approvalId: string;
        status: "approved" | "rejected";
        targetUserId: string;
        reviewedByUserId: string;
        reviewedAt: string | null;
    }> {
        this.assertAdminRole(input.approverRoleName, "Only Admin can review high-risk permission approvals");

        try {
            return await runInTransaction(async () => {
                const approval = await this.permissionsModel.findOverrideApprovalById(input.approvalId);
                if (!approval) throw AppError.notFound("Approval request");
                if (approval.status !== "pending") throw AppError.conflict("Approval request is no longer pending");
                if (approval.requested_by_user_id === input.approverUserId) {
                    throw AppError.forbidden("Two-person approval required: requester cannot review own request");
                }

                if (input.decision === "approved") {
                    await this.permissionsModel.replaceUserOverridesInTransaction(
                        approval.target_user_id,
                        approval.permissions_payload
                    );
                }

                const reviewed = await this.permissionsModel.reviewOverrideApproval({
                    approvalId: input.approvalId,
                    status: input.decision,
                    reviewedByUserId: input.approverUserId,
                    reviewReason: input.reviewReason,
                });
                if (!reviewed) throw AppError.conflict("Approval request is no longer pending");

                if (input.decision === "approved") {
                    await this.invalidateDecisionCacheSafely(approval.target_user_id);
                }

                await this.permissionsModel.createPermissionAudit({
                    actorUserId: input.approverUserId,
                    targetType: "user",
                    targetId: approval.target_user_id,
                    actionType: input.decision === "approved" ? "override_update_approve" : "override_update_reject",
                    payloadBefore: {
                        approvalRequestId: approval.id,
                        status: approval.status,
                        requestedByUserId: approval.requested_by_user_id,
                        riskFlags: approval.risk_flags,
                    },
                    payloadAfter: {
                        status: reviewed.status,
                        reviewedByUserId: reviewed.reviewed_by_user_id,
                        reviewedAt: reviewed.reviewed_at,
                    },
                    reason: input.reviewReason ?? reviewed.reason ?? undefined,
                });

                if (input.decision === "approved") {
                    metrics.countPrivilegeEvent({
                        event: "override_update",
                        result: "success",
                    });
                }

                return {
                    approvalId: reviewed.id,
                    status: reviewed.status as "approved" | "rejected",
                    targetUserId: reviewed.target_user_id,
                    reviewedByUserId: reviewed.reviewed_by_user_id ?? input.approverUserId,
                    reviewedAt: reviewed.reviewed_at,
                };
            });
        } catch (error) {
            if (input.decision === "approved") {
                metrics.countPrivilegeEvent({
                    event: "override_update",
                    result: "error",
                });
            }
            throw error;
        }
    }

    private async invalidateDecisionCacheSafely(userId: string): Promise<void> {
        try {
            await invalidatePermissionDecisionCacheByUser(userId);
        } catch (error) {
            console.warn("[PermissionsService] Failed to invalidate permission decision cache", {
                userId,
                error,
            });
        }
    }

    private collectApprovalRiskFlags(permissions: PermissionUpsertRow[]): ApprovalRiskFlag[] {
        const hasDeleteGrant = permissions.some((row) => row.canDelete);
        const hasAllScopeGrant = permissions.some((row) => {
            const hasAnyGrant = row.canAccess || row.canView || row.canCreate || row.canUpdate || row.canDelete;
            return hasAnyGrant && row.dataScope === "all";
        });

        const flags: ApprovalRiskFlag[] = [];
        if (hasDeleteGrant) flags.push("delete");
        if (hasAllScopeGrant) flags.push("all_scope");
        return flags;
    }

    private assertAdminRole(roleName: string | undefined, message: string): void {
        if (normalizeRoleName(roleName) !== "Admin") {
            throw AppError.forbidden(message);
        }
    }

    async simulatePermission(input: {
        userId: string;
        resourceKey: string;
        actionKey: "access" | "view" | "create" | "update" | "delete";
    }): Promise<{
        allowed: boolean;
        scope: Scope;
        resourceKey: string;
        actionKey: string;
    } | null> {
        const user = await this.usersModel.findOne(input.userId);
        if (!user) return null;

        const { decision } = await resolvePermissionDecisionWithCache({
            userId: input.userId,
            roleId: user.roles_id,
            resourceKey: input.resourceKey,
            actionKey: input.actionKey,
            fetcher: () =>
                this.permissionsModel.findEffectiveDecision(
                    input.userId,
                    user.roles_id,
                    input.resourceKey,
                    input.actionKey
                ),
        });

        return {
            allowed: decision?.effect === "allow",
            scope: (decision?.scope ?? "none") as Scope,
            resourceKey: input.resourceKey,
            actionKey: input.actionKey,
        };
    }

    async getPermissionAudits(params: {
        targetType?: "role" | "user";
        targetId?: string;
        actionType?: string;
        actorUserId?: string;
        from?: string;
        to?: string;
        page: number;
        limit: number;
    }): Promise<{ rows: any[]; total: number; page: number; limit: number }> {
        const page = Math.max(params.page, 1);
        const limit = Math.min(Math.max(params.limit, 1), 100);
        const offset = (page - 1) * limit;

        const result = await this.permissionsModel.findPermissionAudits({
            targetType: params.targetType,
            targetId: params.targetId,
            actionType: params.actionType,
            actorUserId: params.actorUserId,
            from: params.from,
            to: params.to,
            limit,
            offset,
        });

        return {
            rows: result.rows,
            total: result.total,
            page,
            limit,
        };
    }
}
