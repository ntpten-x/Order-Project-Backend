import { NextFunction, Response } from "express";
import { getDbManager } from "../database/dbContext";
import { ApiResponses } from "../utils/ApiResponse";
import type { AuthRequest } from "./auth.middleware";
import { metrics } from "../utils/metrics";
import { resolvePermissionDecisionWithCache } from "../utils/permissionCache";

export type PermissionScope = "none" | "own" | "branch" | "all";

export type RequestPermission = {
    resourceKey: string;
    actionKey: string;
    scope: PermissionScope;
};

type RawPermissionRow = {
    effect: "allow" | "deny" | null;
    scope: PermissionScope | null;
};

async function resolveEffectivePermission(
    userId: string,
    roleId: string,
    resourceKey: string,
    actionKey: string
): Promise<RequestPermission | null> {
    const { decision } = await resolvePermissionDecisionWithCache({
        userId,
        roleId,
        resourceKey,
        actionKey,
        fetcher: async () => {
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

            return (rows?.[0] ?? null) as RawPermissionRow | null;
        },
    });

    if (!decision || decision.effect !== "allow") {
        return null;
    }

    return {
        resourceKey,
        actionKey,
        scope: (decision.scope ?? "none") as PermissionScope,
    };
}

export const authorizePermission = (resourceKey: string, actionKey: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user?.id || !req.user?.roles_id) {
            return ApiResponses.unauthorized(res, "Authentication required");
        }

        const startedAt = process.hrtime.bigint();
        const permission = await resolveEffectivePermission(req.user.id, req.user.roles_id, resourceKey, actionKey);
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        if (!permission) {
            metrics.observePermissionCheck({
                resource: resourceKey,
                action: actionKey,
                decision: "deny",
                scope: "none",
                durationMs,
            });

            return res.status(403).json({
                success: false,
                error: {
                    code: "FORBIDDEN",
                    message: "Access denied: Insufficient permissions",
                    details: {
                        reason: "permission_denied",
                        resource: resourceKey,
                        action: actionKey,
                        scope: "none",
                    },
                },
            });
        }

        metrics.observePermissionCheck({
            resource: resourceKey,
            action: actionKey,
            decision: "allow",
            scope: permission.scope,
            durationMs,
        });
        req.permission = permission;
        next();
    };
};

export const authorizePermissionOrSelf = (
    resourceKey: string,
    actionKey: string,
    paramName: string = "id"
) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user?.id || !req.user?.roles_id) {
            return ApiResponses.unauthorized(res, "Authentication required");
        }

        const targetId = req.params?.[paramName];
        if (targetId && targetId === req.user.id) {
            req.permission = {
                resourceKey,
                actionKey,
                scope: "own",
            };
            return next();
        }

        return authorizePermission(resourceKey, actionKey)(req, res, next);
    };
};

export const enforceUserTargetScope = (paramName: string = "id") => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const scope = req.permission?.scope;
        if (!scope || scope === "none") {
            return ApiResponses.forbidden(res, "Access denied: Data scope is none");
        }

        if (scope === "own") {
            const targetId = req.params?.[paramName];
            if (!targetId || targetId !== req.user?.id) {
                return ApiResponses.forbidden(res, "Access denied: Own scope only");
            }
        }

        next();
    };
};

export const enforceOrderTargetScope = (paramName: string = "id") => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        const scope = req.permission?.scope;
        if (!scope || scope === "none") {
            return ApiResponses.forbidden(res, "Access denied: Data scope is none");
        }

        if (scope !== "own") {
            return next();
        }

        const orderId = req.params?.[paramName];
        if (!orderId) {
            return ApiResponses.badRequest(res, "Order id is required");
        }

        const rows = await getDbManager().query(
            `SELECT created_by_id FROM sales_orders WHERE id = $1 LIMIT 1`,
            [orderId]
        );
        if (!rows?.[0]) {
            return ApiResponses.notFound(res, "Order");
        }

        if (rows[0].created_by_id !== req.user?.id) {
            return ApiResponses.forbidden(res, "Access denied: Own scope only");
        }

        next();
    };
};

export const enforceOrderItemTargetScope = (paramName: string = "itemId") => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        const scope = req.permission?.scope;
        if (!scope || scope === "none") {
            return ApiResponses.forbidden(res, "Access denied: Data scope is none");
        }

        if (scope !== "own") {
            return next();
        }

        const itemId = req.params?.[paramName];
        if (!itemId) {
            return ApiResponses.badRequest(res, "Order item id is required");
        }

        const rows = await getDbManager().query(
            `
                SELECT o.created_by_id
                FROM sales_order_item i
                INNER JOIN sales_orders o ON o.id = i.order_id
                WHERE i.id = $1
                LIMIT 1
            `,
            [itemId]
        );
        if (!rows?.[0]) {
            return ApiResponses.notFound(res, "Order item");
        }

        if (rows[0].created_by_id !== req.user?.id) {
            return ApiResponses.forbidden(res, "Access denied: Own scope only");
        }

        next();
    };
};

export const enforceBranchTargetScope = (paramName: string = "id") => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const scope = req.permission?.scope;
        if (!scope || scope === "none") {
            return ApiResponses.forbidden(res, "Access denied: Data scope is none");
        }

        if (scope === "all") {
            return next();
        }

        const actorBranchId = req.user?.branch_id;
        const targetBranchId = req.params?.[paramName];
        if (!actorBranchId || !targetBranchId || targetBranchId !== actorBranchId) {
            return ApiResponses.forbidden(res, "Access denied: Branch scope only");
        }

        next();
    };
};

export const enforceAuditLogTargetScope = (paramName: string = "id") => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        const scope = req.permission?.scope;
        if (!scope || scope === "none") {
            return ApiResponses.forbidden(res, "Access denied: Data scope is none");
        }

        if (scope === "all") {
            return next();
        }

        const auditId = req.params?.[paramName];
        if (!auditId) {
            return ApiResponses.badRequest(res, "Audit log id is required");
        }

        const rows = await getDbManager().query(
            `SELECT user_id, branch_id FROM audit_logs WHERE id = $1 LIMIT 1`,
            [auditId]
        );

        const log = rows?.[0];
        if (!log) {
            return ApiResponses.notFound(res, "Audit log");
        }

        if (scope === "own") {
            if (!log.user_id || log.user_id !== req.user?.id) {
                return ApiResponses.forbidden(res, "Access denied: Own scope only");
            }
            return next();
        }

        const actorBranchId = req.user?.branch_id;
        if (!actorBranchId || !log.branch_id || log.branch_id !== actorBranchId) {
            return ApiResponses.forbidden(res, "Access denied: Branch scope only");
        }

        next();
    };
};

export const enforceAllScopeOnly = () => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const scope = req.permission?.scope;
        if (!scope || scope === "none") {
            return ApiResponses.forbidden(res, "Access denied: Data scope is none");
        }

        if (scope !== "all") {
            return ApiResponses.forbidden(res, "Access denied: All scope required");
        }

        next();
    };
};
