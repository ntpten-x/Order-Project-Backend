import { Request, Response } from "express";
import { getBranchId } from "../../middleware/branch.middleware";
import { StockCategoryService } from "../../services/stock/category.service";
import { ApiResponses } from "../../utils/ApiResponse";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { getClientIp } from "../../utils/securityLogger";
import { parseCreatedSort } from "../../utils/sortCreated";

export class StockCategoryController {
    constructor(private stockCategoryService: StockCategoryService) {}

    findAll = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 50;
        const limit = Math.min(Math.max(limitRaw, 1), 200);
        const q = (req.query.q as string | undefined) || undefined;
        const statusRaw = (req.query.status as string | undefined) || undefined;
        const status = statusRaw === "active" || statusRaw === "inactive" ? statusRaw : undefined;
        const sortCreated = parseCreatedSort(req.query.sort_created);

        const categories = await this.stockCategoryService.findAllPaginated(
            page,
            limit,
            { ...(q ? { q } : {}), ...(status ? { status } : {}) },
            branchId,
            sortCreated
        );

        return ApiResponses.paginated(res, categories.data, {
            page: categories.page,
            limit: categories.limit,
            total: categories.total,
        });
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const category = await this.stockCategoryService.findOne(req.params.id, branchId);
        if (!category) {
            throw AppError.notFound("Stock category");
        }

        return ApiResponses.ok(res, category);
    });

    findOneByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const category = await this.stockCategoryService.findOneByName(req.params.name, branchId);
        if (!category) {
            throw AppError.notFound("Stock category");
        }

        return ApiResponses.ok(res, category);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }

        const category = await this.stockCategoryService.create(req.body, branchId);
        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.STOCK_CATEGORY_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "StockCategory",
            entity_id: (category as any).id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create stock category ${(category as any).display_name || (category as any).id}`,
        });

        return ApiResponses.created(res, category);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }

        const oldCategory = await this.stockCategoryService.findOne(req.params.id, branchId);
        const category = await this.stockCategoryService.update(req.params.id, req.body, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.STOCK_CATEGORY_UPDATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "StockCategory",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldCategory as any,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Update stock category ${req.params.id}`,
        });

        return ApiResponses.ok(res, category);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const oldCategory = await this.stockCategoryService.findOne(req.params.id, branchId);
        await this.stockCategoryService.delete(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.STOCK_CATEGORY_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "StockCategory",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldCategory as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete stock category ${req.params.id}`,
        });

        return ApiResponses.ok(res, { message: "ลบหมวดหมู่วัตถุดิบเรียบร้อย" });
    });
}
