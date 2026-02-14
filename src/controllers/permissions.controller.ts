import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponses } from "../utils/ApiResponse";
import { PermissionsService } from "../services/permissions.service";
import { setNoStoreHeaders } from "../utils/cacheHeaders";
import { AppError } from "../utils/AppError";
import { AuthRequest } from "../middleware/auth.middleware";
import { parseCreatedSort } from "../utils/sortCreated";

export class PermissionsController {
    constructor(private permissionsService: PermissionsService) { }

    getRoleEffective = catchAsync(async (req: Request, res: Response) => {
        const data = await this.permissionsService.getEffectiveByRoleId(req.params.id);
        if (!data) {
            throw AppError.notFound("Role");
        }
        setNoStoreHeaders(res);
        return ApiResponses.ok(res, data);
    });

    getUserEffective = catchAsync(async (req: Request, res: Response) => {
        const data = await this.permissionsService.getEffectiveByUserId(req.params.id);
        if (!data) {
            throw AppError.notFound("User");
        }
        setNoStoreHeaders(res);
        return ApiResponses.ok(res, data);
    });

    updateUserPermissions = catchAsync(async (req: AuthRequest, res: Response) => {
        const payload = req.body as {
            permissions: Array<{
                resourceKey: string;
                canAccess: boolean;
                canView: boolean;
                canCreate: boolean;
                canUpdate: boolean;
                canDelete: boolean;
                dataScope: "none" | "own" | "branch" | "all";
            }>;
            reason?: string;
        };
        if (!req.user?.id) {
            return ApiResponses.unauthorized(res, "Authentication required");
        }
        const result = await this.permissionsService.submitUserOverrideUpdate({
            targetUserId: req.params.id,
            permissions: payload.permissions,
            actorUserId: req.user.id,
            actorRoleName: req.user.roles?.roles_name,
            reason: payload.reason,
        });

        return ApiResponses.ok(res, result);
    });

    updateRolePermissions = catchAsync(async (req: AuthRequest, res: Response) => {
        const payload = req.body as {
            permissions: Array<{
                resourceKey: string;
                canAccess: boolean;
                canView: boolean;
                canCreate: boolean;
                canUpdate: boolean;
                canDelete: boolean;
                dataScope: "none" | "own" | "branch" | "all";
            }>;
            reason?: string;
        };
        if (!req.user?.id) {
            return ApiResponses.unauthorized(res, "Authentication required");
        }

        await this.permissionsService.replaceRolePermissions(
            req.params.id,
            payload.permissions,
            req.user.id,
            payload.reason
        );

        return ApiResponses.ok(res, { updated: true });
    });

    simulate = catchAsync(async (req: Request, res: Response) => {
        const payload = req.body as {
            userId: string;
            resourceKey: string;
            actionKey: "access" | "view" | "create" | "update" | "delete";
        };
        const data = await this.permissionsService.simulatePermission(payload);
        if (!data) {
            throw AppError.notFound("User");
        }
        setNoStoreHeaders(res);
        return ApiResponses.ok(res, data);
    });

    getAudits = catchAsync(async (req: Request, res: Response) => {
        const query = req.query as Record<string, string | undefined>;
        const page = query.page ? Number(query.page) : 1;
        const limit = query.limit ? Number(query.limit) : 20;
        const targetType = query.targetType as "role" | "user" | undefined;
        const targetId = query.targetId;
        const actionType = query.actionType;
        const actorUserId = query.actorUserId;
        const from = query.from;
        const to = query.to;
        const sortCreated = parseCreatedSort(query.sort_created);

        const result = await this.permissionsService.getPermissionAudits({
            page,
            limit,
            targetType,
            targetId,
            actionType,
            actorUserId,
            from,
            to,
            sortCreated,
        });

        setNoStoreHeaders(res);
        return ApiResponses.paginated(res, result.rows, {
            page: result.page,
            limit: result.limit,
            total: result.total,
        });
    });

    getOverrideApprovals = catchAsync(async (req: Request, res: Response) => {
        const query = req.query as Record<string, string | undefined>;
        const page = query.page ? Number(query.page) : 1;
        const limit = query.limit ? Number(query.limit) : 20;
        const sortCreated = parseCreatedSort(query.sort_created);

        const result = await this.permissionsService.getOverrideApprovals({
            page,
            limit,
            status: query.status as "pending" | "approved" | "rejected" | undefined,
            targetUserId: query.targetUserId,
            requestedByUserId: query.requestedByUserId,
            sortCreated,
        });

        setNoStoreHeaders(res);
        return ApiResponses.paginated(res, result.rows, {
            page: result.page,
            limit: result.limit,
            total: result.total,
        });
    });

    approveOverride = catchAsync(async (req: AuthRequest, res: Response) => {
        if (!req.user?.id) {
            return ApiResponses.unauthorized(res, "Authentication required");
        }

        const payload = (req.body ?? {}) as { reviewReason?: string };
        const result = await this.permissionsService.reviewOverrideApproval({
            approvalId: req.params.id,
            decision: "approved",
            approverUserId: req.user.id,
            approverRoleName: req.user.roles?.roles_name,
            reviewReason: payload.reviewReason,
        });

        return ApiResponses.ok(res, result);
    });

    rejectOverride = catchAsync(async (req: AuthRequest, res: Response) => {
        if (!req.user?.id) {
            return ApiResponses.unauthorized(res, "Authentication required");
        }

        const payload = (req.body ?? {}) as { reviewReason: string };
        const result = await this.permissionsService.reviewOverrideApproval({
            approvalId: req.params.id,
            decision: "rejected",
            approverUserId: req.user.id,
            approverRoleName: req.user.roles?.roles_name,
            reviewReason: payload.reviewReason,
        });

        return ApiResponses.ok(res, result);
    });
}
