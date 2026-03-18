import { Request, Response } from "express";
import { DiscountsService } from "../../services/pos/discounts.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { getBranchId } from "../../middleware/branch.middleware";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { setPrivateSwrHeaders } from "../../utils/cacheHeaders";
import { parseCreatedSort } from "../../utils/sortCreated";
import { resolvePermissionForRequest } from "../../middleware/permission.middleware";
import type { AuthRequest } from "../../middleware/auth.middleware";

const DISCOUNTS_SEARCH_FEATURE = "discounts.search.feature";
const DISCOUNTS_FILTER_FEATURE = "discounts.filter.feature";
const DISCOUNTS_EDIT_FEATURE = "discounts.edit.feature";
const DISCOUNTS_PRICING_FEATURE = "discounts.pricing.feature";
const DISCOUNTS_STATUS_FEATURE = "discounts.status.feature";

async function requireDiscountsFeature(
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
            message: "Access denied: discounts capability not allowed",
            details: {
                reason: "discounts_capability_denied",
                resource: resourceKey,
                action: actionKey,
            },
        },
    });
    return false;
}

export class DiscountsController {
    constructor(private discountsService: DiscountsService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 50;
        const limit = Math.min(Math.max(limitRaw, 1), 200);
        const q = (req.query.q as string | undefined) || undefined;
        const statusRaw = (req.query.status as string | undefined) || undefined;
        const status = statusRaw === "active" || statusRaw === "inactive" ? statusRaw : undefined;
        const type = (req.query.type as string | undefined) || undefined;
        const sortCreated = parseCreatedSort(req.query.sort_created);
        const branchId = getBranchId(req as any);

        if (q?.trim()) {
            const allowed = await requireDiscountsFeature(req, res, DISCOUNTS_SEARCH_FEATURE, "view");
            if (!allowed) return;
        }

        if (status || type || req.query.sort_created !== undefined) {
            const allowed = await requireDiscountsFeature(req, res, DISCOUNTS_FILTER_FEATURE, "view");
            if (!allowed) return;
        }

        const discounts = await this.discountsService.findAllPaginated(
            page,
            limit,
            { ...(q ? { q } : {}), ...(status ? { status } : {}), ...(type ? { type } : {}) },
            branchId,
            sortCreated
        );
        setPrivateSwrHeaders(res);
        return ApiResponses.paginated(res, discounts.data, {
            page: discounts.page,
            limit: discounts.limit,
            total: discounts.total,
        });
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const discount = await this.discountsService.findOne(req.params.id, branchId);
        if (!discount) {
            throw AppError.notFound("ส่วนลด");
        }
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, discount);
    });

    findByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const discount = await this.discountsService.findOneByName(req.params.name, branchId);
        if (!discount) {
            throw AppError.notFound("ส่วนลด");
        }
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, discount);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const discount = await this.discountsService.create(req.body, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.DISCOUNT_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get('User-Agent'),
            entity_type: 'Discounts',
            entity_id: discount.id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create discount ${discount.display_name || discount.id}`,
        });
        return ApiResponses.created(res, discount);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const oldDiscount = await this.discountsService.findOne(req.params.id, branchId);
        if (!oldDiscount) {
            throw AppError.notFound("Discount");
        }

        const requiredCapabilities = new Set<string>();
        const nextDisplayName =
            typeof req.body.display_name === "string" ? req.body.display_name.trim().toLowerCase() : undefined;
        const currentDisplayName = oldDiscount.display_name?.trim().toLowerCase();
        if (nextDisplayName !== undefined && nextDisplayName !== currentDisplayName) {
            requiredCapabilities.add(DISCOUNTS_EDIT_FEATURE);
        }

        if ("description" in req.body) {
            const nextDescription = typeof req.body.description === "string" ? req.body.description.trim() : "";
            const currentDescription = oldDiscount.description?.trim() || "";
            if (nextDescription !== currentDescription) {
                requiredCapabilities.add(DISCOUNTS_EDIT_FEATURE);
            }
        }

        if ("discount_type" in req.body) {
            const nextType = typeof req.body.discount_type === "string" ? req.body.discount_type : undefined;
            if (nextType !== undefined && nextType !== oldDiscount.discount_type) {
                requiredCapabilities.add(DISCOUNTS_PRICING_FEATURE);
            }
        }

        if ("discount_amount" in req.body) {
            const nextAmount = Number(req.body.discount_amount);
            const currentAmount = Number(oldDiscount.discount_amount || 0);
            if (!Number.isNaN(nextAmount) && nextAmount !== currentAmount) {
                requiredCapabilities.add(DISCOUNTS_PRICING_FEATURE);
            }
        }

        if (
            typeof req.body.is_active === "boolean" &&
            Boolean(req.body.is_active) !== Boolean(oldDiscount.is_active)
        ) {
            requiredCapabilities.add(DISCOUNTS_STATUS_FEATURE);
        }

        for (const resourceKey of requiredCapabilities) {
            const allowed = await requireDiscountsFeature(req, res, resourceKey, "update");
            if (!allowed) return;
        }

        const discount = await this.discountsService.update(req.params.id, req.body, branchId);

        if (discount) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.DISCOUNT_UPDATE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "Discounts",
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldDiscount as any,
                new_values: req.body,
                path: req.originalUrl,
                method: req.method,
                description: `Update discount ${req.params.id}`,
            });
        }

        if (!discount) {
            throw AppError.notFound("ส่วนลด");
        }
        return ApiResponses.ok(res, discount);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const oldDiscount = await this.discountsService.findOne(req.params.id, branchId);
        await this.discountsService.delete(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.DISCOUNT_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get('User-Agent'),
            entity_type: 'Discounts',
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldDiscount as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete discount ${req.params.id}`,
        });
        return ApiResponses.ok(res, { message: "ลบข้อมูลส่วนลดสำเร็จ" });
    });
}
