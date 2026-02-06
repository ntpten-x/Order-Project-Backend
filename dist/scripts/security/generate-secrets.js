"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
function toHex(bytes = 32) {
    return (0, node_crypto_1.randomBytes)(bytes).toString("hex");
}
function toBase64Url(bytes = 48) {
    return (0, node_crypto_1.randomBytes)(bytes)
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
