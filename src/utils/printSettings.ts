export const PRINT_DOCUMENT_TYPES = [
    "receipt",
    "order_summary",
    "purchase_order",
    "table_qr",
    "kitchen_ticket",
    "custom",
] as const;

export const PRINT_UNITS = ["mm", "in"] as const;
export const PRINT_ORIENTATIONS = ["portrait", "landscape"] as const;
export const PRINT_PRESETS = [
    "thermal_58mm",
    "thermal_80mm",
    "a4_portrait",
    "a5_portrait",
    "label_4x6",
    "custom",
] as const;
export const PRINT_PRINTER_PROFILES = ["thermal", "laser", "label"] as const;
export const PRINT_DENSITIES = ["compact", "comfortable", "spacious"] as const;
export const PRINT_HEIGHT_MODES = ["auto", "fixed"] as const;

export type PrintDocumentType = (typeof PRINT_DOCUMENT_TYPES)[number];
export type PrintUnit = (typeof PRINT_UNITS)[number];
export type PrintOrientation = (typeof PRINT_ORIENTATIONS)[number];
export type PrintPreset = (typeof PRINT_PRESETS)[number];
export type PrintPrinterProfile = (typeof PRINT_PRINTER_PROFILES)[number];
export type PrintDensity = (typeof PRINT_DENSITIES)[number];
export type PrintHeightMode = (typeof PRINT_HEIGHT_MODES)[number];

export interface PrintDocumentSetting {
    document_type: PrintDocumentType;
    enabled: boolean;
    preset: PrintPreset;
    printer_profile: PrintPrinterProfile;
    unit: PrintUnit;
    orientation: PrintOrientation;
    width: number;
    height: number | null;
    height_mode: PrintHeightMode;
    margin_top: number;
    margin_right: number;
    margin_bottom: number;
    margin_left: number;
    font_scale: number;
    line_spacing: number;
    copies: number;
    density: PrintDensity;
    show_logo: boolean;
    show_qr: boolean;
    show_footer: boolean;
    show_branch_address: boolean;
    show_order_meta: boolean;
    cut_paper: boolean;
    note?: string | null;
}

export interface PrintAutomationSettings {
    auto_print_receipt_after_payment: boolean;
    auto_print_order_summary_after_close_shift: boolean;
    auto_print_purchase_order_after_submit: boolean;
    auto_print_table_qr_after_rotation: boolean;
    auto_print_kitchen_ticket_after_submit: boolean;
}

export interface PrintSettingsDocuments {
    receipt: PrintDocumentSetting;
    order_summary: PrintDocumentSetting;
    purchase_order: PrintDocumentSetting;
    table_qr: PrintDocumentSetting;
    kitchen_ticket: PrintDocumentSetting;
    custom: PrintDocumentSetting;
}

export interface PrintSettingsPayload {
    default_unit: PrintUnit;
    locale: string;
    allow_manual_override: boolean;
    automation: PrintAutomationSettings;
    documents: PrintSettingsDocuments;
}

type PresetDefaults = {
    printer_profile: PrintPrinterProfile;
    width: number;
    height: number | null;
    height_mode: PrintHeightMode;
    orientation: PrintOrientation;
};

const PRESET_DEFAULTS: Record<PrintPreset, PresetDefaults> = {
    thermal_58mm: {
        printer_profile: "thermal",
        width: 58,
        height: null,
        height_mode: "auto",
        orientation: "portrait",
    },
    thermal_80mm: {
        printer_profile: "thermal",
        width: 80,
        height: null,
        height_mode: "auto",
        orientation: "portrait",
    },
    a4_portrait: {
        printer_profile: "laser",
        width: 210,
        height: 297,
        height_mode: "fixed",
        orientation: "portrait",
    },
    a5_portrait: {
        printer_profile: "laser",
        width: 148,
        height: 210,
        height_mode: "fixed",
        orientation: "portrait",
    },
    label_4x6: {
        printer_profile: "label",
        width: 101.6,
        height: 152.4,
        height_mode: "fixed",
        orientation: "portrait",
    },
    custom: {
        printer_profile: "laser",
        width: 210,
        height: 297,
        height_mode: "fixed",
        orientation: "portrait",
    },
};

const BASE_DOCUMENT_DEFAULTS = {
    enabled: true,
    unit: "mm" as PrintUnit,
    margin_top: 4,
    margin_right: 4,
    margin_bottom: 4,
    margin_left: 4,
    font_scale: 100,
    line_spacing: 1.2,
    copies: 1,
    density: "comfortable" as PrintDensity,
    show_logo: true,
    show_qr: false,
    show_footer: true,
    show_branch_address: true,
    show_order_meta: true,
    cut_paper: false,
    note: null,
};

const DOCUMENT_DEFAULT_OVERRIDES: Record<
    PrintDocumentType,
    Partial<PrintDocumentSetting> & { preset: PrintPreset }
> = {
    receipt: {
        preset: "thermal_80mm",
        density: "compact",
        margin_top: 3,
        margin_right: 3,
        margin_bottom: 3,
        margin_left: 3,
        font_scale: 100,
        line_spacing: 1.12,
        show_qr: true,
        cut_paper: true,
    },
    order_summary: {
        preset: "a4_portrait",
        density: "comfortable",
        margin_top: 10,
        margin_right: 10,
        margin_bottom: 12,
        margin_left: 10,
        line_spacing: 1.28,
        show_qr: false,
        cut_paper: false,
    },
    purchase_order: {
        preset: "a4_portrait",
        density: "comfortable",
        margin_top: 12,
        margin_right: 12,
        margin_bottom: 14,
        margin_left: 12,
        line_spacing: 1.3,
        show_qr: false,
        cut_paper: false,
    },
    table_qr: {
        preset: "label_4x6",
        printer_profile: "label",
        density: "comfortable",
        margin_top: 6,
        margin_right: 6,
        margin_bottom: 6,
        margin_left: 6,
        font_scale: 110,
        line_spacing: 1.15,
        show_qr: true,
        show_footer: false,
        show_order_meta: false,
        cut_paper: false,
    },
    kitchen_ticket: {
        preset: "thermal_80mm",
        density: "compact",
        margin_top: 2,
        margin_right: 2,
        margin_bottom: 2,
        margin_left: 2,
        font_scale: 96,
        line_spacing: 1.08,
        show_logo: false,
        show_qr: false,
        show_footer: false,
        show_branch_address: false,
        cut_paper: true,
    },
    custom: {
        preset: "custom",
        enabled: false,
        density: "comfortable",
        margin_top: 8,
        margin_right: 8,
        margin_bottom: 8,
        margin_left: 8,
        font_scale: 100,
        line_spacing: 1.25,
        show_qr: false,
        cut_paper: false,
    },
};

export function createDefaultDocumentSetting(documentType: PrintDocumentType): PrintDocumentSetting {
    const overrides = DOCUMENT_DEFAULT_OVERRIDES[documentType];
    const presetDefaults = PRESET_DEFAULTS[overrides.preset];

    return {
        ...BASE_DOCUMENT_DEFAULTS,
        ...presetDefaults,
        ...overrides,
        document_type: documentType,
    };
}

export function createDefaultPrintSettingsPayload(): PrintSettingsPayload {
    return {
        default_unit: "mm",
        locale: "th-TH",
        allow_manual_override: true,
        automation: {
            auto_print_receipt_after_payment: true,
            auto_print_order_summary_after_close_shift: false,
            auto_print_purchase_order_after_submit: false,
            auto_print_table_qr_after_rotation: false,
            auto_print_kitchen_ticket_after_submit: true,
        },
        documents: {
            receipt: createDefaultDocumentSetting("receipt"),
            order_summary: createDefaultDocumentSetting("order_summary"),
            purchase_order: createDefaultDocumentSetting("purchase_order"),
            table_qr: createDefaultDocumentSetting("table_qr"),
            kitchen_ticket: createDefaultDocumentSetting("kitchen_ticket"),
            custom: createDefaultDocumentSetting("custom"),
        },
    };
}

export function mergePrintSettingsPayload(
    base: Partial<PrintSettingsPayload> | undefined,
    incoming: Partial<PrintSettingsPayload> | undefined
): PrintSettingsPayload {
    const defaults = createDefaultPrintSettingsPayload();
    const existingDocuments = base?.documents;
    const nextDocuments = incoming?.documents;

    const mergeDocument = (documentType: PrintDocumentType): PrintDocumentSetting => ({
        ...defaults.documents[documentType],
        ...(existingDocuments?.[documentType] || {}),
        ...(nextDocuments?.[documentType] || {}),
        document_type: documentType,
    });

    return {
        default_unit: incoming?.default_unit ?? base?.default_unit ?? defaults.default_unit,
        locale: incoming?.locale ?? base?.locale ?? defaults.locale,
        allow_manual_override:
            incoming?.allow_manual_override ??
            base?.allow_manual_override ??
            defaults.allow_manual_override,
        automation: {
            ...defaults.automation,
            ...(base?.automation || {}),
            ...(incoming?.automation || {}),
        },
        documents: {
            receipt: mergeDocument("receipt"),
            order_summary: mergeDocument("order_summary"),
            purchase_order: mergeDocument("purchase_order"),
            table_qr: mergeDocument("table_qr"),
            kitchen_ticket: mergeDocument("kitchen_ticket"),
            custom: mergeDocument("custom"),
        },
    };
}
