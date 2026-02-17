import type { Request } from "express";

function normalizeProxyChain(value: string | undefined): string {
    return (value || "").trim().toLowerCase();
}

export function isTrustedProxyChainConfigured(): boolean {
    const chain = normalizeProxyChain(process.env.TRUST_PROXY_CHAIN);
    return chain !== "" && chain !== "0" && chain !== "false";
}

export function resolveRequestIsSecure(req: Request): boolean {
    if (req.secure) {
        return true;
    }

    if (!isTrustedProxyChainConfigured()) {
        return false;
    }

    const forwardedProtoHeader = req.headers["x-forwarded-proto"];
    const forwardedProto = Array.isArray(forwardedProtoHeader)
        ? forwardedProtoHeader[0]
        : (forwardedProtoHeader ?? "");
    const firstHopProto = forwardedProto.split(",")[0]?.trim().toLowerCase();

    return firstHopProto === "https";
}
