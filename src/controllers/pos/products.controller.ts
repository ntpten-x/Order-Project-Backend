import { Request, Response } from "express";
import { ProductsService } from "../../services/pos/products.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { getBranchId } from "../../middleware/branch.middleware";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { setPrivateSwrHeaders } from "../../utils/cacheHeaders";

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
        const is_active = (() => {
            const raw = req.query.is_active;
            if (raw === undefined || raw === null) return undefined;
            if (Array.isArray(raw)) {
                const first = raw[0];
                if (typeof first !== "string") return undefined;
                if (first === "true") return true;
                if (first === "false") return false;
                return undefined;
            }
            if (typeof raw !== "string") return undefined;
            if (raw === "") return undefined;
            if (raw === "true") return true;
            if (raw === "false") return false;
            return undefined;
        })();
        const branchId = getBranchId(req as any);
        
        const result = await this.productsService.findAll(page, limit, category_id, q, is_active, branchId);
        setPrivateSwrHeaders(res);
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
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, product);
    });

    findOneByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const product = await this.productsService.findOneByName(req.params.product_name, branchId);
        if (!product) {
            throw AppError.notFound("สินค้า");
        }
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, product);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        if (req.body.price_delivery === undefined || req.body.price_delivery === null) {
            req.body.price_delivery = req.body.price ?? 0;
        }
        const product = await this.productsService.create(req.body);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.PRODUCT_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Products",
            entity_id: (product as any).id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create product ${(product as any).product_name || (product as any).display_name || (product as any).id}`,
        });

        return ApiResponses.created(res, product);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const oldProduct = await this.productsService.findOne(req.params.id, branchId);
        const product = await this.productsService.update(req.params.id, req.body, branchId);

        if (product) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.PRODUCT_UPDATE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "Products",
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldProduct as any,
                new_values: req.body,
                path: req.originalUrl,
                method: req.method,
                description: `Update product ${req.params.id}`,
            });
        }

        if (!product) {
            throw AppError.notFound("สินค้า");
        }
        return ApiResponses.ok(res, product);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const oldProduct = await this.productsService.findOne(req.params.id, branchId);
        await this.productsService.delete(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.PRODUCT_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Products",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldProduct as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete product ${req.params.id}`,
        });
        return ApiResponses.ok(res, { message: "สินค้าลบสำเร็จ" });
    });
}   
