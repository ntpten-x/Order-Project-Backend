import { Request, Response } from "express";
import { CategoryService } from "../../services/pos/category.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { getBranchId } from "../../middleware/branch.middleware";

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
        if (branchId && !req.body.branch_id) {
            req.body.branch_id = branchId;
        }
        const category = await this.categoryService.create(req.body);
        return ApiResponses.created(res, category);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const category = await this.categoryService.update(req.params.id, req.body);
        if (!category) {
            throw AppError.notFound("หมวดหมู่");
        }
        return ApiResponses.ok(res, category);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        await this.categoryService.delete(req.params.id);
        return ApiResponses.ok(res, { message: "หมวดหมู่ลบสำเร็จ" });
    });
}