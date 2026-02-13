import { Request, Response } from "express";
import { IngredientsUnitService } from "../../services/stock/ingredientsUnit.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { getBranchId } from "../../middleware/branch.middleware";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";

/**
 * Ingredients Unit Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 * - Branch-based data isolation
 */
export class IngredientsUnitController {
    constructor(private ingredientsUnitService: IngredientsUnitService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 50;
        const limit = Math.min(Math.max(limitRaw, 1), 200);
        const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
        const statusRaw = (req.query.status as string | undefined) || undefined;
        const statusActive = statusRaw === "active" ? true : statusRaw === "inactive" ? false : undefined;
        const q = (req.query.q as string | undefined) || undefined;
        const branchId = getBranchId(req as any);
        const ingredientsUnit = await this.ingredientsUnitService.findAllPaginated(
            page,
            limit,
            {
                ...(typeof (statusActive ?? active) === "boolean" ? { is_active: (statusActive ?? active) as boolean } : {}),
                ...(q ? { q } : {}),
            },
            branchId
        );
        return ApiResponses.paginated(res, ingredientsUnit.data, {
            page: ingredientsUnit.page,
            limit: ingredientsUnit.limit,
            total: ingredientsUnit.total,
        });
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const ingredientsUnit = await this.ingredientsUnitService.findOne(req.params.id, branchId);
        if (!ingredientsUnit) {
            throw AppError.notFound("หน่วยนับวัตถุดิบ");
        }
        return ApiResponses.ok(res, ingredientsUnit);
    });

    findOneByUnitName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const ingredientsUnit = await this.ingredientsUnitService.findOneByUnitName(req.params.unit_name, branchId);
        if (!ingredientsUnit) {
            throw AppError.notFound("หน่วยนับวัตถุดิบ");
        }
        return ApiResponses.ok(res, ingredientsUnit);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const ingredientsUnit = await this.ingredientsUnitService.create(req.body, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.STOCK_INGREDIENT_UNIT_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "IngredientsUnit",
            entity_id: (ingredientsUnit as any).id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create ingredient unit ${(ingredientsUnit as any).unit_name || (ingredientsUnit as any).display_name || (ingredientsUnit as any).id}`,
        });

        return ApiResponses.created(res, ingredientsUnit);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const oldIngredientsUnit = await this.ingredientsUnitService.findOne(req.params.id, branchId);
        const ingredientsUnit = await this.ingredientsUnitService.update(req.params.id, req.body, branchId);

        if (ingredientsUnit) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.STOCK_INGREDIENT_UNIT_UPDATE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "IngredientsUnit",
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldIngredientsUnit as any,
                new_values: req.body,
                path: req.originalUrl,
                method: req.method,
                description: `Update ingredient unit ${req.params.id}`,
            });
        }

        if (!ingredientsUnit) {
            throw AppError.notFound("หน่วยนับวัตถุดิบ");
        }
        return ApiResponses.ok(res, ingredientsUnit);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const oldIngredientsUnit = await this.ingredientsUnitService.findOne(req.params.id, branchId);
        await this.ingredientsUnitService.delete(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.STOCK_INGREDIENT_UNIT_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "IngredientsUnit",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldIngredientsUnit as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete ingredient unit ${req.params.id}`,
        });
        return ApiResponses.ok(res, { message: "หน่วยนับวัตถุดิบลบสำเร็จ" });
    });
}
