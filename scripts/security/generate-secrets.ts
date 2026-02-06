import { randomBytes } from "node:crypto";

function toHex(bytes = 32): string {
    return randomBytes(bytes).toString("hex");
}

function toBase64Url(bytes = 48): string {
    return randomBytes(bytes)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

const payload = {
    generatedAt: new Date().toISOString(),
    JWT_SECRET: toHex(64),
    METRICS_API_KEY: toBase64Url(48),
    SESSION_SECRET: toHex(48),
};

console.log(JSON.stringify(payload, null, 2));
