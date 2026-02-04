import { Request, Response } from "express";
import { CategoryService } from "../../services/pos/category.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { getBranchId } from "../../middleware/branch.middleware";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";

/**
 * Category Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 * - Branch-based data isolation
 */
export class CategoryController {
    constructor(private categoryService: CategoryService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const categories = await this.categoryService.findAll(branchId);
        return ApiResponses.ok(res, categories);
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const category = await this.categoryService.findOne(req.params.id, branchId);
        if (!category) {
            throw AppError.notFound("หมวดหมู่");
        }
        return ApiResponses.ok(res, category);
    });

    findOneByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const category = await this.categoryService.findOneByName(req.params.category_name, branchId);
        if (!category) {
            throw AppError.notFound("หมวดหมู่");
        }
        return ApiResponses.ok(res, category);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const category = await this.categoryService.create(req.body);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.CATEGORY_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Category",
            entity_id: (category as any).id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create category ${(category as any).category_name || (category as any).display_name || (category as any).id}`,
        });

        return ApiResponses.created(res, category);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const oldCategory = await this.categoryService.findOne(req.params.id, branchId);
        const category = await this.categoryService.update(req.params.id, req.body, branchId);

        if (category) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.CATEGORY_UPDATE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "Category",
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldCategory as any,
                new_values: req.body,
                path: req.originalUrl,
                method: req.method,
                description: `Update category ${req.params.id}`,
            });
        }

        if (!category) {
            throw AppError.notFound("หมวดหมู่");
        }
        return ApiResponses.ok(res, category);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const oldCategory = await this.categoryService.findOne(req.params.id, branchId);
        await this.categoryService.delete(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.CATEGORY_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Category",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldCategory as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete category ${req.params.id}`,
        });
        return ApiResponses.ok(res, { message: "หมวดหมู่ลบสำเร็จ" });
    });
}
