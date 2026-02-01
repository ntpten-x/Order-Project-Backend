import { Request, Response } from "express";
import { IngredientsService } from "../../services/stock/ingredients.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";

/**
 * Ingredients Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling with catchAsync
 * - Proper error codes
 */
export class IngredientsController {
    constructor(private ingredientsService: IngredientsService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
        const ingredients = await this.ingredientsService.findAll(
            active !== undefined ? { is_active: active } : undefined
        );
        return ApiResponses.ok(res, ingredients);
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const ingredient = await this.ingredientsService.findOne(req.params.id);
        if (!ingredient) {
            throw AppError.notFound("วัตถุดิบ");
        }
        return ApiResponses.ok(res, ingredient);
    });

    findOneByName = catchAsync(async (req: Request, res: Response) => {
        const ingredient = await this.ingredientsService.findOneByName(req.params.ingredient_name);
        if (!ingredient) {
            throw AppError.notFound("วัตถุดิบ");
        }
        return ApiResponses.ok(res, ingredient);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const ingredient = await this.ingredientsService.create(req.body);
        return ApiResponses.created(res, ingredient);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const ingredient = await this.ingredientsService.update(req.params.id, req.body);
        if (!ingredient) {
            throw AppError.notFound("วัตถุดิบ");
        }
        return ApiResponses.ok(res, ingredient);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        await this.ingredientsService.delete(req.params.id);
        return ApiResponses.ok(res, { message: "วัตถุดิบลบสำเร็จ" });
    });
}
