import { Request, Response } from "express";
import { PaymentMethodService } from "../../services/pos/paymentMethod.service";
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

const PAYMENT_METHOD_SEARCH_FEATURE = "payment_method.search.feature";
const PAYMENT_METHOD_FILTER_FEATURE = "payment_method.filter.feature";
const PAYMENT_METHOD_CATALOG_FEATURE = "payment_method.catalog.feature";
const PAYMENT_METHOD_STATUS_FEATURE = "payment_method.status.feature";

async function requirePaymentMethodFeature(
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
            message: "Access denied: payment method capability not allowed",
            details: {
                reason: "payment_method_capability_denied",
                resource: resourceKey,
                action: actionKey,
            },
        },
    });
    return false;
}

export class PaymentMethodController {
    constructor(private paymentMethodService: PaymentMethodService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const rawLimit = parseInt(req.query.limit as string);
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
        const q = (req.query.q as string | undefined) || undefined;
        const statusRaw = (req.query.status as string | undefined) || undefined;
        const status = statusRaw === "active" || statusRaw === "inactive" ? statusRaw : undefined;
        const sortCreated = parseCreatedSort(req.query.sort_created);
        const branchId = getBranchId(req as any);

        if (q?.trim()) {
            const allowed = await requirePaymentMethodFeature(req, res, PAYMENT_METHOD_SEARCH_FEATURE, "view");
            if (!allowed) return;
        }

        if (status || req.query.sort_created !== undefined) {
            const allowed = await requirePaymentMethodFeature(req, res, PAYMENT_METHOD_FILTER_FEATURE, "view");
            if (!allowed) return;
        }

        const result = await this.paymentMethodService.findAll(page, limit, q, status, branchId, sortCreated);
        setPrivateSwrHeaders(res);
        return ApiResponses.paginated(res, result.data, {
            page: result.page,
            limit,
            total: result.total,
        });
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const paymentMethod = await this.paymentMethodService.findOne(req.params.id, branchId);
        if (!paymentMethod) throw AppError.notFound("Payment method");
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, paymentMethod);
    });

    findByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const paymentMethod = await this.paymentMethodService.findOneByName(req.params.name, branchId);
        if (!paymentMethod) throw AppError.notFound("Payment method");
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, paymentMethod);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const paymentMethod = await this.paymentMethodService.create(req.body, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.PAYMENT_METHOD_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "PaymentMethod",
            entity_id: (paymentMethod as any).id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create payment method ${(paymentMethod as any).payment_method_name || (paymentMethod as any).id}`,
        });

        return ApiResponses.created(res, paymentMethod);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const oldPaymentMethod = await this.paymentMethodService.findOne(req.params.id, branchId);
        if (!oldPaymentMethod) {
            throw AppError.notFound("Payment method");
        }

        const requiredCapabilities = new Set<string>();
        const nextPaymentMethodName =
            typeof req.body.payment_method_name === "string" ? req.body.payment_method_name.trim().toLowerCase() : undefined;
        const currentPaymentMethodName = oldPaymentMethod.payment_method_name?.trim().toLowerCase();
        if (nextPaymentMethodName !== undefined && nextPaymentMethodName !== currentPaymentMethodName) {
            requiredCapabilities.add(PAYMENT_METHOD_CATALOG_FEATURE);
        }

        if ("display_name" in req.body) {
            const nextDisplayName = typeof req.body.display_name === "string" ? req.body.display_name.trim() : "";
            const currentDisplayName = oldPaymentMethod.display_name?.trim() || "";
            if (nextDisplayName !== currentDisplayName) {
                requiredCapabilities.add(PAYMENT_METHOD_CATALOG_FEATURE);
            }
        }

        if (
            typeof req.body.is_active === "boolean" &&
            Boolean(req.body.is_active) !== Boolean(oldPaymentMethod.is_active)
        ) {
            requiredCapabilities.add(PAYMENT_METHOD_STATUS_FEATURE);
        }

        for (const resourceKey of requiredCapabilities) {
            const allowed = await requirePaymentMethodFeature(req, res, resourceKey, "update");
            if (!allowed) return;
        }

        const paymentMethod = await this.paymentMethodService.update(req.params.id, req.body, branchId);

        if (paymentMethod) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.PAYMENT_METHOD_UPDATE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "PaymentMethod",
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldPaymentMethod as any,
                new_values: req.body,
                path: req.originalUrl,
                method: req.method,
                description: `Update payment method ${req.params.id}`,
            });
        }
        return ApiResponses.ok(res, paymentMethod);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        /* try {
            const branchId = getBranchId(req as any);
            await this.paymentMethodService.delete(req.params.id, branchId)
            res.status(200).json({ message: "ลบข้อมูลวิธีการชำระเงินสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        } */

        const branchId = getBranchId(req as any);
        const oldPaymentMethod = await this.paymentMethodService.findOne(req.params.id, branchId);
        await this.paymentMethodService.delete(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.PAYMENT_METHOD_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "PaymentMethod",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldPaymentMethod as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete payment method ${req.params.id}`,
        });
        return ApiResponses.noContent(res);
    });
}
