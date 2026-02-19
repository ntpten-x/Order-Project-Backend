import type { Request } from "express";

function extractHost(value: string | undefined): string {
    const raw = (value || "").trim();
    if (!raw) return "";

    let candidate = raw;

    if (raw.includes("://")) {
        try {
            candidate = new URL(raw).hostname;
        } catch {
            candidate = raw;
        }
    }

    candidate = candidate
        .replace(/^\.*/, "")
        .split("/")[0]
        .split(":")[0]
        .trim()
        .toLowerCase();

    return candidate;
}

function isIpv4(host: string): boolean {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function getFirstHeaderValue(raw: string | string[] | undefined): string {
    if (Array.isArray(raw)) {
        return extractHost(raw[0] || "");
    }

    return extractHost((raw || "").split(",")[0] || "");
}

export function resolveConfiguredCookieDomain(): string | undefined {
    const domain = extractHost(process.env.COOKIE_DOMAIN);
    if (!domain) return undefined;

    if (domain === "localhost" || domain.endsWith(".localhost")) {
        return undefined;
    }

    if (isIpv4(domain)) {
        return undefined;
    }

    return domain;
}

export function resolveCookieDomainForRequest(req: Pick<Request, "hostname" | "headers">): string | undefined {
    const configuredDomain = resolveConfiguredCookieDomain();
    if (!configuredDomain) return undefined;

    const requestHost =
        getFirstHeaderValue(req.headers?.["x-forwarded-host"]) ||
        extractHost(req.hostname || req.headers?.host || "");

    if (!requestHost) {
        return configuredDomain;
    }

    if (requestHost === configuredDomain || requestHost.endsWith(`.${configuredDomain}`)) {
        return configuredDomain;
    }

    return undefined;
}
