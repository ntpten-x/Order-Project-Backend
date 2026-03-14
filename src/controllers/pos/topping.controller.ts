import { Request, Response } from "express";
import { ToppingService } from "../../services/pos/topping.service";
import { getBranchId } from "../../middleware/branch.middleware";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponses } from "../../utils/ApiResponse";
import { AppError } from "../../utils/AppError";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { setPrivateSwrHeaders } from "../../utils/cacheHeaders";
import { parseCreatedSort } from "../../utils/sortCreated";

export class ToppingController {
    constructor(private toppingService: ToppingService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 50;
        const limit = Math.min(Math.max(limitRaw, 1), 200);
        const q = (req.query.q as string | undefined) || undefined;
        const statusRaw = (req.query.status as string | undefined) || undefined;
        const status = statusRaw === "active" || statusRaw === "inactive" ? statusRaw : undefined;
        const category_id = (req.query.category_id as string | undefined) || undefined;
        const sortCreated = parseCreatedSort(req.query.sort_created);
        const branchId = getBranchId(req as any);
        const toppings = await this.toppingService.findAllPaginated(
            page,
            limit,
            { ...(q ? { q } : {}), ...(status ? { status } : {}), ...(category_id ? { category_id } : {}) },
            branchId,
            sortCreated
        );
        setPrivateSwrHeaders(res);
        return ApiResponses.paginated(res, toppings.data, {
            page: toppings.page,
            limit: toppings.limit,
            total: toppings.total,
        });
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const topping = await this.toppingService.findOne(req.params.id, branchId);
        if (!topping) throw AppError.notFound("Topping");
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, topping);
    });

    findOneByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const topping = await this.toppingService.findOneByName(req.params.name, branchId);
        if (!topping) throw AppError.notFound("Topping");
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, topping);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const topping = await this.toppingService.create(req.body, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.TOPPING_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Topping",
            entity_id: topping.id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create topping ${topping.display_name || topping.id}`,
        });

        return ApiResponses.created(res, topping);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const oldTopping = await this.toppingService.findOne(req.params.id, branchId);
        const topping = await this.toppingService.update(req.params.id, req.body, branchId);

        if (topping) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.TOPPING_UPDATE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "Topping",
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldTopping as any,
                new_values: req.body,
                path: req.originalUrl,
                method: req.method,
                description: `Update topping ${req.params.id}`,
            });
        }
        return ApiResponses.ok(res, topping);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const oldTopping = await this.toppingService.findOne(req.params.id, branchId);
        await this.toppingService.delete(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.TOPPING_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Topping",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldTopping as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete topping ${req.params.id}`,
        });
        return ApiResponses.noContent(res);
    });
}
