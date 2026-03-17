import { AuditLog } from "../entity/AuditLog";

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;
const MAX_KEYS = 200;

const SENSITIVE_KEY_PATTERNS = [
    /(^|_)(password|password_confirmation|passcode)$/i,
    /(^|_)(token|access_token|refresh_token|id_token)$/i,
    /(^|_)(secret|client_secret|api_key|x_api_key|private_key|authorization|cookie)$/i,
    /^qr_code_token$/i,
];

function shouldRedactKey(key: string): boolean {
    return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function maskAccountNumber(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;

    const visible = trimmed.slice(-4);
    const maskedLength = Math.max(trimmed.length - visible.length, 0);
    return `${"*".repeat(maskedLength)}${visible}`;
}

function sanitizePrimitive(key: string | null, value: unknown): unknown {
    if (typeof value !== "string") {
        return value;
    }

    if (key && shouldRedactKey(key)) {
        return REDACTED;
    }

    if (key === "account_number") {
        return maskAccountNumber(value);
    }

    return value;
}

export function sanitizeAuditSnapshot(value: unknown, depth: number = 0): unknown {
    if (value === null || value === undefined) {
        return value;
    }

    if (depth >= MAX_DEPTH) {
        return "[TRUNCATED]";
    }

    if (Array.isArray(value)) {
        return value.slice(0, MAX_KEYS).map((item) => sanitizeAuditSnapshot(item, depth + 1));
    }

    if (typeof value !== "object") {
        return sanitizePrimitive(null, value);
    }

    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS);
    return Object.fromEntries(
        entries.map(([key, entryValue]) => {
            if (shouldRedactKey(key)) {
                return [key, REDACTED];
            }

            if (typeof entryValue !== "object" || entryValue === null) {
                return [key, sanitizePrimitive(key, entryValue)];
            }

            return [key, sanitizeAuditSnapshot(entryValue, depth + 1)];
        })
    );
}

export function sanitizeAuditLogForResponse(log: AuditLog): AuditLog {
    return {
        ...log,
        old_values: sanitizeAuditSnapshot(log.old_values) as Record<string, unknown> | undefined,
        new_values: sanitizeAuditSnapshot(log.new_values) as Record<string, unknown> | undefined,
    };
}
