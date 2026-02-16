import { Request, Response, NextFunction } from "express";
import { BranchService } from "../services/branch.service";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponses } from "../utils/ApiResponse";
import { AppError } from "../utils/AppError";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../utils/auditLogger";
import { getClientIp } from "../utils/securityLogger";
import { setNoStoreHeaders } from "../utils/cacheHeaders";
import { parseCreatedSort } from "../utils/sortCreated";
import { normalizeRoleName } from "../utils/role";

export class BranchController {
    private branchService = new BranchService();

    getAll = catchAsync(async (req: Request, res: Response) => {
        const actorRole = normalizeRoleName((req as any).user?.roles?.roles_name);
        const isAdmin = actorRole === "Admin";
        const actorBranchId = (req as any).user?.branch_id as string | undefined;
        // Defense in depth: list endpoint should not rely solely on RLS.
        // If the DB role can bypass RLS (common in local dev with postgres superuser),
        // this prevents leaking all branches to non-admins.
        const forceBranchId = !isAdmin ? actorBranchId : undefined;

        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 50;
        const limit = Math.min(Math.max(limitRaw, 1), 200);
        const activeRaw = req.query.active as string | undefined;
        const isActive = activeRaw === "true" ? true : activeRaw === "false" ? false : undefined;
        const q = (req.query.q as string | undefined) || undefined;
        const sortCreated = parseCreatedSort(req.query.sort_created);
        const branches = await this.branchService.findAllPaginated(page, limit, isActive, q, sortCreated, forceBranchId);
        setNoStoreHeaders(res);
        return ApiResponses.paginated(res, branches.data, {
            page: branches.page,
            limit: branches.limit,
            total: branches.total,
        });
    });

    getOne = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const branch = await this.branchService.findOne(id);
        if (!branch) {
            throw AppError.notFound("Branch");
        }
        setNoStoreHeaders(res);
        return ApiResponses.ok(res, branch);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branch = await this.branchService.create(req.body);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.BRANCH_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Branch",
            entity_id: branch.id,
            branch_id: userInfo.branch_id,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create branch ${branch.branch_name || branch.id}`,
        });

        return ApiResponses.created(res, branch);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const oldBranch = await this.branchService.findOne(id);
        const branch = await this.branchService.update(id, req.body);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.BRANCH_UPDATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Branch",
            entity_id: id,
            branch_id: userInfo.branch_id,
            old_values: oldBranch as any,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Update branch ${id}`,
        });

        return ApiResponses.ok(res, branch);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const oldBranch = await this.branchService.findOne(id);
        await this.branchService.delete(id);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.BRANCH_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Branch",
            entity_id: id,
            branch_id: userInfo.branch_id,
            old_values: oldBranch as any,
            new_values: { is_active: false },
            path: req.originalUrl,
            method: req.method,
            description: `Delete branch ${id}`,
        });

        return ApiResponses.ok(res, { message: "Branch deleted successfully" });
    });
}
