import { Request, Response } from "express";
import { ProductsUnitService } from "../../services/pos/productsUnit.service";
import { getBranchId } from "../../middleware/branch.middleware";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponses } from "../../utils/ApiResponse";
import { AppError } from "../../utils/AppError";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { setPrivateSwrHeaders } from "../../utils/cacheHeaders";
import { parseCreatedSort } from "../../utils/sortCreated";
import { resolvePermissionForRequest } from "../../middleware/permission.middleware";
import type { AuthRequest } from "../../middleware/auth.middleware";

const PRODUCTS_UNIT_SEARCH_FEATURE = "products_unit.search.feature";
const PRODUCTS_UNIT_FILTER_FEATURE = "products_unit.filter.feature";
const PRODUCTS_UNIT_EDIT_FEATURE = "products_unit.edit.feature";
const PRODUCTS_UNIT_STATUS_FEATURE = "products_unit.status.feature";

async function requireProductsUnitFeature(
    req: Request,
    res: Response,
    resourceKey: string,
    actionKey: "access" | "view" | "update"
): Promise<boolean> {
    const permission = await resolvePermissionForRequest(req as AuthRequest, resourceKey, actionKey);
    if (permission) {
        return true;
    }

    res.status(403).json({
        success: false,
        error: {
            code: "FORBIDDEN",
            message: "Access denied: products unit capability not allowed",
            details: {
                reason: "products_unit_capability_denied",
                resource: resourceKey,
                action: actionKey,
            },
        },
    });
    return false;
}

export class ProductsUnitController {
    constructor(private productsUnitService: ProductsUnitService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 50;
        const limit = Math.min(Math.max(limitRaw, 1), 200);
        const q = (req.query.q as string | undefined) || undefined;
        const statusRaw = (req.query.status as string | undefined) || undefined;
        const status = statusRaw === "active" || statusRaw === "inactive" ? statusRaw : undefined;
        const sortCreated = parseCreatedSort(req.query.sort_created);
        const branchId = getBranchId(req as any);

        if (q?.trim()) {
            const allowed = await requireProductsUnitFeature(req, res, PRODUCTS_UNIT_SEARCH_FEATURE, "view");
            if (!allowed) return;
        }

        if (status || req.query.sort_created !== undefined) {
            const allowed = await requireProductsUnitFeature(req, res, PRODUCTS_UNIT_FILTER_FEATURE, "view");
            if (!allowed) return;
        }

        const productsUnits = await this.productsUnitService.findAllPaginated(
            page,
            limit,
            { ...(q ? { q } : {}), ...(status ? { status } : {}) },
            branchId,
            sortCreated
        );
        setPrivateSwrHeaders(res);
        return ApiResponses.paginated(res, productsUnits.data, {
            page: productsUnits.page,
            limit: productsUnits.limit,
            total: productsUnits.total,
        });
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const productsUnit = await this.productsUnitService.findOne(req.params.id, branchId);
        if (!productsUnit) throw AppError.notFound("Products unit");
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, productsUnit);
    });

    findOneByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const productsUnit = await this.productsUnitService.findOneByName(req.params.name, branchId);
        if (!productsUnit) throw AppError.notFound("Products unit");
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, productsUnit);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const productsUnit = await this.productsUnitService.create(req.body, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.PRODUCTS_UNIT_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "ProductsUnit",
            entity_id: (productsUnit as any).id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create products unit ${(productsUnit as any).display_name || (productsUnit as any).id}`,
        });

        return ApiResponses.created(res, productsUnit);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const oldProductsUnit = await this.productsUnitService.findOne(req.params.id, branchId);
        if (!oldProductsUnit) {
            throw AppError.notFound("Products unit");
        }

        const requiredCapabilities = new Set<string>();
        if ("display_name" in req.body) {
            const nextDisplayName = typeof req.body.display_name === "string" ? req.body.display_name.trim() : "";
            const currentDisplayName = oldProductsUnit.display_name?.trim() || "";
            if (nextDisplayName !== currentDisplayName) {
                requiredCapabilities.add(PRODUCTS_UNIT_EDIT_FEATURE);
            }
        }

        if (
            typeof req.body.is_active === "boolean" &&
            Boolean(req.body.is_active) !== Boolean(oldProductsUnit.is_active)
        ) {
            requiredCapabilities.add(PRODUCTS_UNIT_STATUS_FEATURE);
        }

        for (const resourceKey of requiredCapabilities) {
            const allowed = await requireProductsUnitFeature(req, res, resourceKey, "update");
            if (!allowed) return;
        }

        const productsUnit = await this.productsUnitService.update(req.params.id, req.body, branchId);

        if (productsUnit) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.PRODUCTS_UNIT_UPDATE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "ProductsUnit",
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldProductsUnit as any,
                new_values: req.body,
                path: req.originalUrl,
                method: req.method,
                description: `Update products unit ${req.params.id}`,
            });
        }
        return ApiResponses.ok(res, productsUnit);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        /* try {
            const branchId = getBranchId(req as any);
            await this.productsUnitService.delete(req.params.id, branchId)
            res.status(200).json({ message: "หน่วยสินค้าลบสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        } */

        const branchId = getBranchId(req as any);
        const oldProductsUnit = await this.productsUnitService.findOne(req.params.id, branchId);
        await this.productsUnitService.delete(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.PRODUCTS_UNIT_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "ProductsUnit",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldProductsUnit as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete products unit ${req.params.id}`,
        });
        return ApiResponses.noContent(res);
    });
}   
