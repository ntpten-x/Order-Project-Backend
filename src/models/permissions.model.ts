import { getDbManager } from "../database/dbContext";
import { EntityManager } from "typeorm";
import { CreatedSort, createdSortToOrder } from "../utils/sortCreated";

export type RolePermissionMatrixRecord = {
    resource_key: string;
    resource_name: string;
    route_pattern: string | null;
    action_key: string;
    effect: "allow" | "deny" | null;
    scope: "none" | "own" | "branch" | "all" | null;
    sort_order: number;
};

export type UserPermissionMatrixRecord = {
    resource_key: string;
    action_key: string;
    effect: "allow" | "deny" | null;
    scope: "none" | "own" | "branch" | "all" | null;
};

export type PermissionUpsertRow = {
    resourceKey: string;
    canAccess: boolean;
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    dataScope: "none" | "own" | "branch" | "all";
};

export type PermissionAuditRecord = {
    id: string;
    actor_user_id: string;
    target_type: "role" | "user";
    target_id: string;
    action_type: string;
    payload_before: Record<string, unknown> | null;
    payload_after: Record<string, unknown> | null;
    reason: string | null;
    created_at: string;
};

export type SimulateRecord = {
    effect: "allow" | "deny" | null;
    scope: "none" | "own" | "branch" | "all" | null;
};

export type PermissionOverrideApprovalStatus = "pending" | "approved" | "rejected";

export type PermissionOverrideApprovalRecord = {
    id: string;
    target_user_id: string;
    requested_by_user_id: string;
    reviewed_by_user_id: string | null;
    status: PermissionOverrideApprovalStatus;
    reason: string | null;
    review_reason: string | null;
    risk_flags: string[];
    permissions_payload: PermissionUpsertRow[];
    created_at: string;
    reviewed_at: string | null;
};

export class PermissionsModel {
    async findRoleMatrix(roleId: string): Promise<RolePermissionMatrixRecord[]> {
        return getDbManager().query(
            `
                SELECT
                    pr.resource_key,
                    pr.resource_name,
                    pr.route_pattern,
                    pa.action_key,
                    rp.effect,
                    rp.scope,
                    pr.sort_order
                FROM permission_resources pr
                CROSS JOIN permission_actions pa
                LEFT JOIN role_permissions rp
                    ON rp.resource_id = pr.id
                    AND rp.action_id = pa.id
                    AND rp.role_id = $1
                WHERE pr.is_active = true
                  AND pa.is_active = true
                  AND pr.resource_type = 'page'
                ORDER BY pr.sort_order ASC, pr.resource_name ASC, pa.action_key ASC
            `,
            [roleId]
        );
    }

    async findUserOverrides(userId: string): Promise<UserPermissionMatrixRecord[]> {
        return getDbManager().query(
            `
                SELECT
                    pr.resource_key,
                    pa.action_key,
                    up.effect,
                    up.scope
                FROM permission_resources pr
                CROSS JOIN permission_actions pa
                LEFT JOIN user_permissions up
                    ON up.resource_id = pr.id
                    AND up.action_id = pa.id
                    AND up.user_id = $1
                WHERE pr.is_active = true
                  AND pa.is_active = true
                  AND pr.resource_type = 'page'
                ORDER BY pr.sort_order ASC, pr.resource_name ASC, pa.action_key ASC
            `,
            [userId]
        );
    }

    async findEffectiveDecision(userId: string, roleId: string, resourceKey: string, actionKey: string): Promise<SimulateRecord | null> {
        const rows = await getDbManager().query(
            `
                WITH selected_resource AS (
                    SELECT id
                    FROM permission_resources
                    WHERE resource_key = $1
                      AND is_active = true
                    LIMIT 1
                ),
                selected_action AS (
                    SELECT id
                    FROM permission_actions
                    WHERE action_key = $2
                      AND is_active = true
                    LIMIT 1
                ),
                role_rule AS (
                    SELECT rp.effect, rp.scope
                    FROM role_permissions rp
                    INNER JOIN selected_resource sr ON sr.id = rp.resource_id
                    INNER JOIN selected_action sa ON sa.id = rp.action_id
                    WHERE rp.role_id = $3
                    LIMIT 1
                ),
                user_rule AS (
                    SELECT up.effect, up.scope
                    FROM user_permissions up
                    INNER JOIN selected_resource sr ON sr.id = up.resource_id
                    INNER JOIN selected_action sa ON sa.id = up.action_id
                    WHERE up.user_id = $4
                    LIMIT 1
                )
                SELECT
                    COALESCE((SELECT effect FROM user_rule), (SELECT effect FROM role_rule)) AS effect,
                    COALESCE((SELECT scope FROM user_rule), (SELECT scope FROM role_rule), 'none') AS scope
            `,
            [resourceKey, actionKey, roleId, userId]
        );

        return (rows?.[0] ?? null) as SimulateRecord | null;
    }

    async createPermissionAudit(input: {
        actorUserId: string;
        targetType: "role" | "user";
        targetId: string;
        actionType: string;
        payloadBefore?: Record<string, unknown>;
        payloadAfter?: Record<string, unknown>;
        reason?: string;
    }): Promise<void> {
        await getDbManager().query(
            `
                INSERT INTO permission_audits (
                    actor_user_id,
                    target_type,
                    target_id,
                    action_type,
                    payload_before,
                    payload_after,
                    reason
                )
                VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
            `,
            [
                input.actorUserId,
                input.targetType,
                input.targetId,
                input.actionType,
                input.payloadBefore ? JSON.stringify(input.payloadBefore) : null,
                input.payloadAfter ? JSON.stringify(input.payloadAfter) : null,
                input.reason ?? null,
            ]
        );
    }

    async findPermissionAudits(filters: {
        targetType?: "role" | "user";
        targetId?: string;
        actionType?: string;
        actorUserId?: string;
        from?: string;
        to?: string;
        limit: number;
        offset: number;
        sortCreated?: CreatedSort;
    }): Promise<{ rows: PermissionAuditRecord[]; total: number }> {
        const clauses: string[] = [];
        const params: Array<string | number> = [];

        if (filters.targetType) {
            params.push(filters.targetType);
            clauses.push(`target_type = $${params.length}`);
        }
        if (filters.targetId) {
            params.push(filters.targetId);
            clauses.push(`target_id = $${params.length}`);
        }
        if (filters.actionType) {
            params.push(filters.actionType);
            clauses.push(`action_type = $${params.length}`);
        }
        if (filters.actorUserId) {
            params.push(filters.actorUserId);
            clauses.push(`actor_user_id = $${params.length}`);
        }
        if (filters.from) {
            params.push(filters.from);
            clauses.push(`created_at >= $${params.length}::timestamptz`);
        }
        if (filters.to) {
            params.push(filters.to);
            clauses.push(`created_at <= $${params.length}::timestamptz`);
        }

        const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

        const countRows = await getDbManager().query(
            `SELECT COUNT(*)::int AS total FROM permission_audits ${whereSql}`,
            params
        );
        const total = Number(countRows?.[0]?.total ?? 0);

        const dataParams = [...params, filters.limit, filters.offset];
        const limitIndex = params.length + 1;
        const offsetIndex = params.length + 2;
        const rows = await getDbManager().query(
            `
                SELECT
                    id,
                    actor_user_id,
                    target_type,
                    target_id,
                    action_type,
                    payload_before,
                    payload_after,
                    reason,
                    created_at
                FROM permission_audits
                ${whereSql}
                ORDER BY created_at ${createdSortToOrder(filters.sortCreated ?? "old")}
                LIMIT $${limitIndex}
                OFFSET $${offsetIndex}
            `,
            dataParams
        );

        return {
            rows: rows as PermissionAuditRecord[],
            total,
        };
    }

    async createOverrideApprovalRequest(input: {
        targetUserId: string;
        requestedByUserId: string;
        reason?: string;
        riskFlags: string[];
        permissionsPayload: PermissionUpsertRow[];
    }): Promise<PermissionOverrideApprovalRecord> {
        const rows = await getDbManager().query(
            `
                INSERT INTO permission_override_approvals (
                    target_user_id,
                    requested_by_user_id,
                    status,
                    reason,
                    risk_flags,
                    permissions_payload
                )
                VALUES ($1, $2, 'pending', $3, $4::jsonb, $5::jsonb)
                RETURNING
                    id,
                    target_user_id,
                    requested_by_user_id,
                    reviewed_by_user_id,
                    status,
                    reason,
                    review_reason,
                    risk_flags,
                    permissions_payload,
                    created_at,
                    reviewed_at
            `,
            [
                input.targetUserId,
                input.requestedByUserId,
                input.reason ?? null,
                JSON.stringify(input.riskFlags),
                JSON.stringify(input.permissionsPayload),
            ]
        );

        return rows[0] as PermissionOverrideApprovalRecord;
    }

    async findOverrideApprovalById(id: string): Promise<PermissionOverrideApprovalRecord | null> {
        const rows = await getDbManager().query(
            `
                SELECT
                    id,
                    target_user_id,
                    requested_by_user_id,
                    reviewed_by_user_id,
                    status,
                    reason,
                    review_reason,
                    risk_flags,
                    permissions_payload,
                    created_at,
                    reviewed_at
                FROM permission_override_approvals
                WHERE id = $1
                LIMIT 1
            `,
            [id]
        );

        return (rows?.[0] ?? null) as PermissionOverrideApprovalRecord | null;
    }

    async reviewOverrideApproval(input: {
        approvalId: string;
        status: Exclude<PermissionOverrideApprovalStatus, "pending">;
        reviewedByUserId: string;
        reviewReason?: string;
    }): Promise<PermissionOverrideApprovalRecord | null> {
        const rows = await getDbManager().query(
            `
                UPDATE permission_override_approvals
                SET
                    status = $2,
                    reviewed_by_user_id = $3,
                    review_reason = $4,
                    reviewed_at = now()
                WHERE id = $1
                  AND status = 'pending'
                RETURNING
                    id,
                    target_user_id,
                    requested_by_user_id,
                    reviewed_by_user_id,
                    status,
                    reason,
                    review_reason,
                    risk_flags,
                    permissions_payload,
                    created_at,
                    reviewed_at
            `,
            [
                input.approvalId,
                input.status,
                input.reviewedByUserId,
                input.reviewReason ?? null,
            ]
        );

        return (rows?.[0] ?? null) as PermissionOverrideApprovalRecord | null;
    }

    async findOverrideApprovals(filters: {
        status?: PermissionOverrideApprovalStatus;
        targetUserId?: string;
        requestedByUserId?: string;
        page: number;
        limit: number;
        sortCreated?: CreatedSort;
    }): Promise<{ rows: PermissionOverrideApprovalRecord[]; total: number }> {
        const clauses: string[] = [];
        const params: Array<string | number> = [];

        if (filters.status) {
            params.push(filters.status);
            clauses.push(`status = $${params.length}`);
        }
        if (filters.targetUserId) {
            params.push(filters.targetUserId);
            clauses.push(`target_user_id = $${params.length}`);
        }
        if (filters.requestedByUserId) {
            params.push(filters.requestedByUserId);
            clauses.push(`requested_by_user_id = $${params.length}`);
        }

        const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

        const countRows = await getDbManager().query(
            `SELECT COUNT(*)::int AS total FROM permission_override_approvals ${whereSql}`,
            params
        );
        const total = Number(countRows?.[0]?.total ?? 0);

        const dataParams = [...params, filters.limit, (filters.page - 1) * filters.limit];
        const limitIndex = params.length + 1;
        const offsetIndex = params.length + 2;

        const rows = await getDbManager().query(
            `
                SELECT
                    id,
                    target_user_id,
                    requested_by_user_id,
                    reviewed_by_user_id,
                    status,
                    reason,
                    review_reason,
                    risk_flags,
                    permissions_payload,
                    created_at,
                    reviewed_at
                FROM permission_override_approvals
                ${whereSql}
                ORDER BY created_at ${createdSortToOrder(filters.sortCreated ?? "old")}
                LIMIT $${limitIndex}
                OFFSET $${offsetIndex}
            `,
            dataParams
        );

        return {
            rows: rows as PermissionOverrideApprovalRecord[],
            total,
        };
    }

    async replaceUserOverridesInTransaction(userId: string, permissions: PermissionUpsertRow[]): Promise<void> {
        await this.replaceUserOverridesWithManager(getDbManager(), userId, permissions);
    }

    async replaceUserOverrides(userId: string, permissions: PermissionUpsertRow[]): Promise<void> {
        const manager = getDbManager();
        await manager.transaction(async (tx) => {
            await this.replaceUserOverridesWithManager(tx, userId, permissions);
        });
    }

    private async replaceUserOverridesWithManager(
        manager: EntityManager,
        userId: string,
        permissions: PermissionUpsertRow[]
    ): Promise<void> {
        await manager.query(`DELETE FROM user_permissions WHERE user_id = $1`, [userId]);

        for (const row of permissions) {
            const actions = [
                { actionKey: "access", enabled: row.canAccess },
                { actionKey: "view", enabled: row.canView },
                { actionKey: "create", enabled: row.canCreate },
                { actionKey: "update", enabled: row.canUpdate },
                { actionKey: "delete", enabled: row.canDelete },
            ];

            for (const action of actions) {
                const effect = action.enabled ? "allow" : "deny";
                const scope = action.enabled ? row.dataScope : "none";

                await manager.query(
                    `
                        INSERT INTO user_permissions (user_id, resource_id, action_id, effect, scope)
                        SELECT
                            $1,
                            pr.id,
                            pa.id,
                            $2::varchar,
                            $3::varchar
                        FROM permission_resources pr
                        INNER JOIN permission_actions pa
                            ON pa.action_key = $4
                           AND pa.is_active = true
                        WHERE pr.resource_key = $5
                          AND pr.is_active = true
                          AND pr.resource_type = 'page'
                    `,
                    [userId, effect, scope, action.actionKey, row.resourceKey]
                );
            }
        }
    }
}
