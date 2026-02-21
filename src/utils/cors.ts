const DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://18.143.76.86:3001",
    "https://system.pos-hub.shop",
];

function parseListEnv(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizeOrigin(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";

    try {
        const parsed = new URL(trimmed);
        return `${parsed.protocol}//${parsed.host}`.toLowerCase();
    } catch {
        return trimmed.replace(/\/+$/, "").toLowerCase();
    }
}

export function resolveAllowedOrigins(): string[] {
    const fromEnvList = parseListEnv(process.env.FRONTEND_ALLOWED_ORIGINS);
    const values = [...DEFAULT_ALLOWED_ORIGINS, process.env.FRONTEND_URL || "", ...fromEnvList];
    const unique = new Set<string>();

    for (const value of values) {
        const normalized = normalizeOrigin(value);
        if (normalized) {
            unique.add(normalized);
        }
    }

    return Array.from(unique);
}

export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) return false;
    if (allowedOrigins.includes("*")) return true;

    return allowedOrigins.some((allowedOrigin) => {
        if (allowedOrigin === normalizedOrigin) return true;

        // Supports wildcard subdomain format: https://*.example.com
        if (!allowedOrigin.includes("*.")) return false;
        const match = allowedOrigin.match(/^(https?):\/\/\*\.(.+)$/);
        if (!match) return false;

        const protocol = match[1];
        const suffix = match[2];
        if (!normalizedOrigin.startsWith(`${protocol}://`)) return false;

        const host = normalizedOrigin.slice(`${protocol}://`.length);
        return host === suffix || host.endsWith(`.${suffix}`);
    });
}

export function buildCorsOriginChecker(allowedOrigins: string[]) {
    return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) {
            callback(null, true);
            return;
        }

        if (isOriginAllowed(origin, allowedOrigins)) {
            callback(null, true);
            return;
        }

        callback(new Error(`CORS blocked for origin: ${origin}`));
    };
}
