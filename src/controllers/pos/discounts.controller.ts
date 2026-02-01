import { Request, Response } from "express";
import { DiscountsService } from "../../services/pos/discounts.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { getBranchId } from "../../middleware/branch.middleware";

export class DiscountsController {
    constructor(private discountsService: DiscountsService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const q = (req.query.q as string | undefined) || undefined;
        const branchId = getBranchId(req as any);
        const discounts = await this.discountsService.findAll(q, branchId);
        return ApiResponses.ok(res, discounts);
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const discount = await this.discountsService.findOne(req.params.id, branchId);
        if (!discount) {
            throw AppError.notFound("ส่วนลด");
        }
        return ApiResponses.ok(res, discount);
    });

    findByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const discount = await this.discountsService.findOneByName(req.params.name, branchId);
        if (!discount) {
            throw AppError.notFound("ส่วนลด");
        }
        return ApiResponses.ok(res, discount);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId && !req.body.branch_id) {
            req.body.branch_id = branchId;
        }
        const discount = await this.discountsService.create(req.body);
        return ApiResponses.created(res, discount);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const discount = await this.discountsService.update(req.params.id, req.body);
        if (!discount) {
            throw AppError.notFound("ส่วนลด");
        }
        return ApiResponses.ok(res, discount);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        await this.discountsService.delete(req.params.id);
        return ApiResponses.ok(res, { message: "ลบข้อมูลส่วนลดสำเร็จ" });
    });
}
