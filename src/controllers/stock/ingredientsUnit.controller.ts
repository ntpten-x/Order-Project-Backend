import { Request, Response } from "express";
import { IngredientsUnitService } from "../../services/stock/ingredientsUnit.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";

/**
 * Ingredients Unit Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 */
export class IngredientsUnitController {
    constructor(private ingredientsUnitService: IngredientsUnitService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
        const ingredientsUnit = await this.ingredientsUnitService.findAll(
            active !== undefined ? { is_active: active } : undefined
        );
        return ApiResponses.ok(res, ingredientsUnit);
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const ingredientsUnit = await this.ingredientsUnitService.findOne(req.params.id);
        if (!ingredientsUnit) {
            throw AppError.notFound("หน่วยนับวัตถุดิบ");
        }
        return ApiResponses.ok(res, ingredientsUnit);
    });

    findOneByUnitName = catchAsync(async (req: Request, res: Response) => {
        const ingredientsUnit = await this.ingredientsUnitService.findOneByUnitName(req.params.unit_name);
        if (!ingredientsUnit) {
            throw AppError.notFound("หน่วยนับวัตถุดิบ");
        }
        return ApiResponses.ok(res, ingredientsUnit);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const ingredientsUnit = await this.ingredientsUnitService.create(req.body);
        return ApiResponses.created(res, ingredientsUnit);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const ingredientsUnit = await this.ingredientsUnitService.update(req.params.id, req.body);
        if (!ingredientsUnit) {
            throw AppError.notFound("หน่วยนับวัตถุดิบ");
        }
        return ApiResponses.ok(res, ingredientsUnit);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        await this.ingredientsUnitService.delete(req.params.id);
        return ApiResponses.ok(res, { message: "หน่วยนับวัตถุดิบลบสำเร็จ" });
    });
}