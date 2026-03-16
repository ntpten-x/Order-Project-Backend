import { Request, Response } from "express";
import { ToppingGroupService } from "../../services/pos/toppingGroup.service";
import { getBranchId } from "../../middleware/branch.middleware";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponses } from "../../utils/ApiResponse";
import { AppError } from "../../utils/AppError";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { setPrivateSwrHeaders } from "../../utils/cacheHeaders";
import { parseCreatedSort } from "../../utils/sortCreated";

export class ToppingGroupController {
    constructor(private toppingGroupService: ToppingGroupService) {}

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 50;
        const limit = Math.min(Math.max(limitRaw, 1), 200);
        const q = (req.query.q as string | undefined) || undefined;
        const statusRaw = (req.query.status as string | undefined) || undefined;
        const status = statusRaw === "active" || statusRaw === "inactive" ? statusRaw : undefined;
        const sortCreated = parseCreatedSort(req.query.sort_created);
        const branchId = getBranchId(req as any);
        const toppingGroups = await this.toppingGroupService.findAllPaginated(
            page,
            limit,
            { ...(q ? { q } : {}), ...(status ? { status } : {}) },
            branchId,
            sortCreated
        );
        setPrivateSwrHeaders(res);
        return ApiResponses.paginated(res, toppingGroups.data, {
            page: toppingGroups.page,
            limit: toppingGroups.limit,
            total: toppingGroups.total,
        });
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const toppingGroup = await this.toppingGroupService.findOne(req.params.id, branchId);
        if (!toppingGroup) throw AppError.notFound("Topping group");
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, toppingGroup);
    });

    findOneByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const toppingGroup = await this.toppingGroupService.findOneByName(req.params.name, branchId);
        if (!toppingGroup) throw AppError.notFound("Topping group");
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, toppingGroup);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const toppingGroup = await this.toppingGroupService.create(req.body);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.TOPPING_GROUP_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "ToppingGroup",
            entity_id: toppingGroup.id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create topping group ${toppingGroup.display_name || toppingGroup.id}`,
        });

        return ApiResponses.created(res, toppingGroup);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const oldToppingGroup = await this.toppingGroupService.findOne(req.params.id, branchId);
        const toppingGroup = await this.toppingGroupService.update(req.params.id, req.body, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.TOPPING_GROUP_UPDATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "ToppingGroup",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldToppingGroup as any,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Update topping group ${req.params.id}`,
        });
        return ApiResponses.ok(res, toppingGroup);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const oldToppingGroup = await this.toppingGroupService.findOne(req.params.id, branchId);
        await this.toppingGroupService.delete(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.TOPPING_GROUP_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "ToppingGroup",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldToppingGroup as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete topping group ${req.params.id}`,
        });
        return ApiResponses.noContent(res);
    });
}
