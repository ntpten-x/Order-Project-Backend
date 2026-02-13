import { Request, Response } from "express";
import { IngredientsService } from "../../services/stock/ingredients.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { getBranchId } from "../../middleware/branch.middleware";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";

/**
 * Ingredients Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling with catchAsync
 * - Proper error codes
 * - Branch-based data isolation
 */
export class IngredientsController {
    constructor(private ingredientsService: IngredientsService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 50;
        const limit = Math.min(Math.max(limitRaw, 1), 200);
        const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
        const statusRaw = (req.query.status as string | undefined) || undefined;
        const statusActive = statusRaw === "active" ? true : statusRaw === "inactive" ? false : undefined;
        const q = (req.query.q as string | undefined) || undefined;
        const branchId = getBranchId(req as any);
        const ingredients = await this.ingredientsService.findAllPaginated(
            page,
            limit,
            {
                ...(typeof (statusActive ?? active) === "boolean" ? { is_active: (statusActive ?? active) as boolean } : {}),
                ...(q ? { q } : {}),
            },
            branchId
        );
        return ApiResponses.paginated(res, ingredients.data, {
            page: ingredients.page,
            limit: ingredients.limit,
            total: ingredients.total,
        });
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const ingredient = await this.ingredientsService.findOne(req.params.id, branchId);
        if (!ingredient) {
            throw AppError.notFound("วัตถุดิบ");
        }
        return ApiResponses.ok(res, ingredient);
    });

    findOneByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const ingredient = await this.ingredientsService.findOneByName(req.params.ingredient_name, branchId);
        if (!ingredient) {
            throw AppError.notFound("วัตถุดิบ");
        }
        return ApiResponses.ok(res, ingredient);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const ingredient = await this.ingredientsService.create(req.body);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.STOCK_INGREDIENT_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Ingredients",
            entity_id: (ingredient as any).id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create ingredient ${(ingredient as any).ingredient_name || (ingredient as any).display_name || (ingredient as any).id}`,
        });

        return ApiResponses.created(res, ingredient);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const oldIngredient = await this.ingredientsService.findOne(req.params.id, branchId);
        const ingredient = await this.ingredientsService.update(req.params.id, req.body, branchId);

        if (ingredient) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.STOCK_INGREDIENT_UPDATE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "Ingredients",
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldIngredient as any,
                new_values: req.body,
                path: req.originalUrl,
                method: req.method,
                description: `Update ingredient ${req.params.id}`,
            });
        }

        if (!ingredient) {
            throw AppError.notFound("วัตถุดิบ");
        }
        return ApiResponses.ok(res, ingredient);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const oldIngredient = await this.ingredientsService.findOne(req.params.id, branchId);
        await this.ingredientsService.delete(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.STOCK_INGREDIENT_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Ingredients",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldIngredient as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete ingredient ${req.params.id}`,
        });
        return ApiResponses.ok(res, { message: "วัตถุดิบลบสำเร็จ" });
    });
}
