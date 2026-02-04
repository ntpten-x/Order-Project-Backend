import { Request, Response } from "express";
import { ShopProfileService } from "../../services/pos/shopProfile.service";
import { ShopProfileModels } from "../../models/pos/shopProfile.model";
import { getBranchId } from "../../middleware/branch.middleware";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponses } from "../../utils/ApiResponse";
import { AppError } from "../../utils/AppError";
import { getClientIp } from "../../utils/securityLogger";

const service = new ShopProfileService(new ShopProfileModels());

export const getShopProfile = catchAsync(async (req: Request, res: Response) => {
    const branchId = getBranchId(req as any);
    if (!branchId) throw AppError.forbidden("Access denied: No branch assigned to user");

    const profile = await service.getProfile(branchId);
    return ApiResponses.ok(res, profile);
});

export const updateShopProfile = catchAsync(async (req: Request, res: Response) => {
    const branchId = getBranchId(req as any);
    if (!branchId) throw AppError.forbidden("Access denied: No branch assigned to user");

    const oldProfile = await service.getProfile(branchId);
    req.body.branch_id = branchId;
    const profile = await service.updateProfile(branchId, req.body);

    const userInfo = getUserInfoFromRequest(req as any);
    await auditLogger.log({
        action_type: AuditActionType.SHOP_PROFILE_UPDATE,
        ...userInfo,
        ip_address: getClientIp(req),
        user_agent: req.get("User-Agent"),
        entity_type: "ShopProfile",
        entity_id: profile.id,
        branch_id: branchId,
        old_values: oldProfile as any,
        new_values: req.body,
        path: req.originalUrl,
        method: req.method,
        description: `Update shop profile ${profile.id}`,
    });

    return ApiResponses.ok(res, profile);
});
