import { Request, Response } from "express";
import { SalesOrderItemService } from "../../services/pos/salesOrderItem.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";

/**
 * Sales Order Item Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 */
export class SalesOrderItemController {
    constructor(private salesOrderItemService: SalesOrderItemService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const items = await this.salesOrderItemService.findAll();
        return ApiResponses.ok(res, items);
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const item = await this.salesOrderItemService.findOne(req.params.id);
        if (!item) {
            throw AppError.notFound("รายการสินค้า");
        }
        return ApiResponses.ok(res, item);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const item = await this.salesOrderItemService.create(req.body);
        return ApiResponses.created(res, item);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const item = await this.salesOrderItemService.update(req.params.id, req.body);
        if (!item) {
            throw AppError.notFound("รายการสินค้า");
        }
        return ApiResponses.ok(res, item);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        await this.salesOrderItemService.delete(req.params.id);
        return ApiResponses.ok(res, { message: "ลบรายการสินค้าในออเดอร์สำเร็จ" });
    });
}
