import { Request, Response } from "express";
import { getBranchId } from "../../middleware/branch.middleware";
import { IngredientsService } from "../../services/stock/ingredients.service";
import { ApiResponses } from "../../utils/ApiResponse";
import { AppError } from "../../utils/AppError";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { catchAsync } from "../../utils/catchAsync";
import { normalizeImageSourceInput } from "../../utils/imageSource";
import { getClientIp } from "../../utils/securityLogger";
import { parseCreatedSort } from "../../utils/sortCreated";

function normalizeDescription(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeImageUrl(value: unknown): string | null {
    return normalizeImageSourceInput(value);
}

export class IngredientsController {
    constructor(private ingredientsService: IngredientsService) {}

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 50;
        const limit = Math.min(Math.max(limitRaw, 1), 200);
        const active = req.query.active === "true" ? true : req.query.active === "false" ? false : undefined;
        const statusRaw = (req.query.status as string | undefined) || undefined;
        const statusActive = statusRaw === "active" ? true : statusRaw === "inactive" ? false : undefined;
        const q = (req.query.q as string | undefined) || undefined;
        const categoryIdRaw = (req.query.category_id as string | undefined) || undefined;
        const categoryId =
            categoryIdRaw === "uncategorized"
                ? "uncategorized"
                : categoryIdRaw?.trim()
                    ? categoryIdRaw.trim()
                    : undefined;
        const sortCreated = parseCreatedSort(req.query.sort_created);
        const branchId = getBranchId(req as any);

        const ingredients = await this.ingredientsService.findAllPaginated(
            page,
            limit,
            {
                ...(typeof (statusActive ?? active) === "boolean"
                    ? { is_active: (statusActive ?? active) as boolean }
                    : {}),
                ...(q ? { q } : {}),
                ...(categoryId ? { category_id: categoryId } : {}),
            },
            branchId,
            sortCreated
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
            throw new AppError("ไม่พบวัตถุดิบ", 404);
        }

        return ApiResponses.ok(res, ingredient);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }

        req.body.description = normalizeDescription(req.body.description);
        req.body.img_url = normalizeImageUrl(req.body.img_url);
        const ingredient = await this.ingredientsService.create(req.body, branchId);

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
            description: `Create ingredient ${(ingredient as any).display_name || (ingredient as any).id}`,
        });

        return ApiResponses.created(res, ingredient);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }

        if ("description" in req.body) {
            req.body.description = normalizeDescription(req.body.description);
        }
        if ("img_url" in req.body) {
            req.body.img_url = normalizeImageUrl(req.body.img_url);
        }

        const oldIngredient = await this.ingredientsService.findOne(req.params.id, branchId);
        const ingredient = await this.ingredientsService.update(req.params.id, req.body, branchId);

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

        return ApiResponses.ok(res, { message: "ลบวัตถุดิบเรียบร้อย" });
    });
}
