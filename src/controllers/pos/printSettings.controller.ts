import { Request, Response } from "express";
import { getBranchId } from "../../middleware/branch.middleware";
import { resolvePermissionForRequest } from "../../middleware/permission.middleware";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponses } from "../../utils/ApiResponse";
import { AppError } from "../../utils/AppError";
import { getClientIp } from "../../utils/securityLogger";
import { setNoStoreHeaders } from "../../utils/cacheHeaders";
import { PrintSettingsModel } from "../../models/pos/printSettings.model";
import { PrintSettingsService } from "../../services/pos/printSettings.service";
import {
    mergePrintSettingsPayload,
    type PrintDocumentSetting,
    type PrintSettingsPayload,
    PRINT_DOCUMENT_TYPES,
} from "../../utils/printSettings";

const service = new PrintSettingsService(new PrintSettingsModel());

const PRINT_PERMISSION_KEYS = {
    branchDefaults: "print_settings.branch_defaults.feature",
    overridePolicy: "print_settings.override_policy.feature",
    automation: "print_settings.automation.feature",
    presets: "print_settings.presets.feature",
    layout: "print_settings.layout.feature",
    visibility: "print_settings.visibility.feature",
    publish: "print_settings.publish.feature",
} as const;

const DOCUMENT_PRESET_FIELDS: Array<keyof PrintDocumentSetting> = ["preset"];
const DOCUMENT_LAYOUT_FIELDS: Array<keyof PrintDocumentSetting> = [
    "printer_profile",
    "unit",
    "orientation",
    "width",
    "height",
    "height_mode",
    "margin_top",
    "margin_right",
    "margin_bottom",
    "margin_left",
    "font_scale",
    "line_spacing",
    "copies",
    "density",
];
const DOCUMENT_VISIBILITY_FIELDS: Array<keyof PrintDocumentSetting> = [
    "enabled",
    "show_logo",
    "show_qr",
    "show_footer",
    "show_branch_address",
    "show_order_meta",
    "cut_paper",
    "note",
];

function buildSettingsPayloadFromEntity(entity: {
    default_unit: PrintSettingsPayload["default_unit"];
    locale: string;
    allow_manual_override: boolean;
    automation: PrintSettingsPayload["automation"];
    documents: PrintSettingsPayload["documents"];
}): PrintSettingsPayload {
    return mergePrintSettingsPayload(
        {
            default_unit: entity.default_unit,
            locale: entity.locale,
            allow_manual_override: entity.allow_manual_override,
            automation: entity.automation,
            documents: entity.documents,
        },
        undefined
    );
}

function isChanged<T>(beforeValue: T, afterValue: T): boolean {
    return JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
}

function collectRequiredPrintSettingPermissions(
    beforeState: PrintSettingsPayload,
    afterState: PrintSettingsPayload
): string[] {
    const required = new Set<string>([PRINT_PERMISSION_KEYS.publish]);

    if (
        isChanged(beforeState.default_unit, afterState.default_unit) ||
        isChanged(beforeState.locale, afterState.locale)
    ) {
        required.add(PRINT_PERMISSION_KEYS.branchDefaults);
    }

    if (isChanged(beforeState.allow_manual_override, afterState.allow_manual_override)) {
        required.add(PRINT_PERMISSION_KEYS.overridePolicy);
    }

    if (isChanged(beforeState.automation, afterState.automation)) {
        required.add(PRINT_PERMISSION_KEYS.automation);
    }

    for (const documentType of PRINT_DOCUMENT_TYPES) {
        const beforeDocument = beforeState.documents[documentType];
        const afterDocument = afterState.documents[documentType];

        if (DOCUMENT_PRESET_FIELDS.some((field) => isChanged(beforeDocument[field], afterDocument[field]))) {
            required.add(PRINT_PERMISSION_KEYS.presets);
        }

        if (DOCUMENT_LAYOUT_FIELDS.some((field) => isChanged(beforeDocument[field], afterDocument[field]))) {
            required.add(PRINT_PERMISSION_KEYS.layout);
        }

        if (DOCUMENT_VISIBILITY_FIELDS.some((field) => isChanged(beforeDocument[field], afterDocument[field]))) {
            required.add(PRINT_PERMISSION_KEYS.visibility);
        }
    }

    return Array.from(required);
}

async function assertPrintSettingsUpdatePermissions(
    req: AuthRequest,
    requiredResourceKeys: string[]
): Promise<void> {
    const denied: string[] = [];

    for (const resourceKey of requiredResourceKeys) {
        const permission = await resolvePermissionForRequest(req, resourceKey, "update");
        if (!permission) {
            denied.push(resourceKey);
        }
    }

    if (denied.length > 0) {
        throw AppError.forbidden(
            `Access denied: Missing print settings capability (${denied.join(", ")})`
        );
    }
}

export const getPrintSettings = catchAsync(async (req: Request, res: Response) => {
    const branchId = getBranchId(req as any);
    if (!branchId) throw AppError.forbidden("Access denied: No branch assigned to user");

    const settings = await service.getSettings(branchId);
    setNoStoreHeaders(res);
    return ApiResponses.ok(res, settings);
});

export const updatePrintSettings = catchAsync(async (req: Request, res: Response) => {
    const branchId = getBranchId(req as any);
    if (!branchId) throw AppError.forbidden("Access denied: No branch assigned to user");

    const authReq = req as AuthRequest;
    const oldSettings = await service.getSettings(branchId);
    const beforeState = buildSettingsPayloadFromEntity(oldSettings);
    const requestedState = mergePrintSettingsPayload(beforeState, {
        ...(req.body ?? {}),
        locale: typeof req.body?.locale === "string" ? req.body.locale.trim() : req.body?.locale,
    });
    const requiredPermissions = collectRequiredPrintSettingPermissions(beforeState, requestedState);
    await assertPrintSettingsUpdatePermissions(authReq, requiredPermissions);

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

    setNoStoreHeaders(res);
    return ApiResponses.ok(res, settings);
});
