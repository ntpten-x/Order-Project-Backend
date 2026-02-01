import { Request, Response } from "express";
import { ProductsService } from "../../services/pos/products.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { getBranchId } from "../../middleware/branch.middleware";

/**
 * Products Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 * - Pagination support
 * - Branch-based data isolation
 */
export class ProductsController {
    constructor(private productsService: ProductsService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const rawLimit = parseInt(req.query.limit as string);
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
        const category_id = req.query.category_id as string;
        const q = (req.query.q as string | undefined) || undefined;
        const branchId = getBranchId(req as any);
        
        const result = await this.productsService.findAll(page, limit, category_id, q, branchId);
        
        return ApiResponses.paginated(res, result.data, {
            page: result.page,
            limit: limit,
            total: result.total,
        });
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const product = await this.productsService.findOne(req.params.id, branchId);
        if (!product) {
            throw AppError.notFound("สินค้า");
        }
        return ApiResponses.ok(res, product);
    });

    findOneByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const product = await this.productsService.findOneByName(req.params.product_name, branchId);
        if (!product) {
            throw AppError.notFound("สินค้า");
        }
        return ApiResponses.ok(res, product);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId && !req.body.branch_id) {
            req.body.branch_id = branchId;
        }
        const product = await this.productsService.create(req.body);
        return ApiResponses.created(res, product);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const product = await this.productsService.update(req.params.id, req.body);
        if (!product) {
            throw AppError.notFound("สินค้า");
        }
        return ApiResponses.ok(res, product);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        await this.productsService.delete(req.params.id);
        return ApiResponses.ok(res, { message: "สินค้าลบสำเร็จ" });
    });
}   
