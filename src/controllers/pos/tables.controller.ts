import { Request, Response } from "express";
import { TablesService } from "../../services/pos/tables.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";

/**
 * Tables Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 * - Pagination support
 */
export class TablesController {
    constructor(private tablesService: TablesService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const rawLimit = parseInt(req.query.limit as string);
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
        const q = (req.query.q as string | undefined) || undefined;
        const branchId = (req as any).user?.branch_id;

        const result = await this.tablesService.findAll(page, limit, q, branchId);
        
        // Check if result has pagination structure
        if (result.data && result.total !== undefined) {
            return ApiResponses.paginated(res, result.data, {
                page: result.page || page,
                limit: limit,
                total: result.total,
            });
        }
        
        return ApiResponses.ok(res, result);
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const table = await this.tablesService.findOne(req.params.id);
        if (!table) {
            throw AppError.notFound("โต๊ะ");
        }
        return ApiResponses.ok(res, table);
    });

    findByName = catchAsync(async (req: Request, res: Response) => {
        const table = await this.tablesService.findOneByName(req.params.name);
        if (!table) {
            throw AppError.notFound("โต๊ะ");
        }
        return ApiResponses.ok(res, table);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = (req as any).user?.branch_id;
        if (branchId && !req.body.branch_id) {
            req.body.branch_id = branchId;
        }
        const table = await this.tablesService.create(req.body);
        return ApiResponses.created(res, table);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const table = await this.tablesService.update(req.params.id, req.body);
        if (!table) {
            throw AppError.notFound("โต๊ะ");
        }
        return ApiResponses.ok(res, table);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        await this.tablesService.delete(req.params.id);
        return ApiResponses.ok(res, { message: "ลบข้อมูลโต๊ะสำเร็จ" });
    });
}
