import { Request, Response } from "express";
import { getBranchId } from "../../middleware/branch.middleware";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponses } from "../../utils/ApiResponse";
import { AppError } from "../../utils/AppError";
import { getClientIp } from "../../utils/securityLogger";
import { PrintSettingsModel } from "../../models/pos/printSettings.model";
import { PrintSettingsService } from "../../services/pos/printSettings.service";

const service = new PrintSettingsService(new PrintSettingsModel());

export const getPrintSettings = catchAsync(async (req: Request, res: Response) => {
    const branchId = getBranchId(req as any);
    if (!branchId) throw AppError.forbidden("Access denied: No branch assigned to user");

    const settings = await service.getSettings(branchId);
    return ApiResponses.ok(res, settings);
});

export const updatePrintSettings = catchAsync(async (req: Request, res: Response) => {
    const branchId = getBranchId(req as any);
    if (!branchId) throw AppError.forbidden("Access denied: No branch assigned to user");

    const oldSettings = await service.getSettings(branchId);
    const settings = await service.updateSettings(branchId, req.body);

    const userInfo = getUserInfoFromRequest(req as any);
    await auditLogger.log({
        action_type: AuditActionType.PRINT_SETTINGS_UPDATE,
        ...userInfo,
        ip_address: getClientIp(req),
        user_agent: req.get("User-Agent"),
        entity_type: "PrintSettings",
        entity_id: settings.id,
        branch_id: branchId,
        old_values: oldSettings as unknown as Record<string, unknown>,
        new_values: settings as unknown as Record<string, unknown>,
        path: req.originalUrl,
        method: req.method,
        description: `Update print settings ${settings.id}`,
    });

    return ApiResponses.ok(res, settings);
});

