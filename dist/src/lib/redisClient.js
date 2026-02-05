"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisPrefix = getRedisPrefix;
exports.getRedisClient = getRedisClient;
exports.getSessionKey = getSessionKey;
const redis_1 = require("redis");
let client = null;
let initializing = null;
const REDIS_URL = process.env.REDIS_URL;
const DEFAULT_REDIS_PREFIX = process.env.REDIS_PREFIX || "order-app";
const parseBoolean = (value) => {
    if (value === undefined)
        return undefined;
    const lower = value.toLowerCase();
    if (lower === "true")
        return true;
    if (lower === "false")
        return false;
    return undefined;
};
const isSslWrongVersionError = (err) => {
    if (!err || typeof err !== "object")
        return false;
    const anyErr = err;
    if (anyErr.code === "ERR_SSL_WRONG_VERSION_NUMBER")
        return true;
    const msg = typeof anyErr.message === "string" ? anyErr.message : "";
    return msg.toLowerCase().includes("wrong version number");
};
const normalizeRedisScheme = (url, tlsEnabled) => {
    if (tlsEnabled)
        return url.replace(/^redis:/, "rediss:");
    return url.replace(/^rediss:/, "redis:");
};
function buildRedisConfig(url, tlsEnabled, rejectUnauthorized) {
    const parsed = new URL(url);
    const socket = {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : undefined,
        tls: tlsEnabled,
        connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 5000,
        reconnectStrategy: (retries, cause) => {
            // Stop reconnect loops on TLS-protocol mismatch so we can fall back cleanly.
            if (isSslWrongVersionError(cause))
                return cause;
            return Math.min(retries * 50, 500);
        },
    };
    if (tlsEnabled) {
        socket.servername = parsed.hostname;
        socket.rejectUnauthorized = rejectUnauthorized;
    }
    return { url, socket };
}
function getRedisPrefix(namespace) {
    return `${DEFAULT_REDIS_PREFIX}:${namespace}:`;
}
function getRedisClient() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!REDIS_URL) {
            return null;
        }
        if (client)
            return client;
        if (initializing)
            return initializing;
        initializing = (() => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const tlsOverride = parseBoolean(process.env.REDIS_TLS);
                const urlWantsTls = REDIS_URL.startsWith("rediss://");
                const tlsEnabled = tlsOverride !== null && tlsOverride !== void 0 ? tlsOverride : urlWantsTls;
                const rejectUnauthorized = (_a = parseBoolean(process.env.REDIS_TLS_REJECT_UNAUTHORIZED)) !== null && _a !== void 0 ? _a : false;
                const normalizedUrl = normalizeRedisScheme(REDIS_URL, tlsEnabled);
                const fallbackSetting = parseBoolean(process.env.REDIS_TLS_AUTO_FALLBACK);
                const autoTlsFallback = fallbackSetting !== null && fallbackSetting !== void 0 ? fallbackSetting : (process.env.NODE_ENV !== "production");
                const allowFallbackWhenForcedTls = fallbackSetting === true;
                const instance = (0, redis_1.createClient)(buildRedisConfig(normalizedUrl, tlsEnabled, rejectUnauthorized));
                instance.on("error", (err) => {
                    console.error("[Redis] Client error:", err);
                });
                try {
                    yield instance.connect();
                    client = instance;
                    return instance;
                }
                catch (err) {
                    if (autoTlsFallback &&
                        isSslWrongVersionError(err) &&
                        (tlsOverride === undefined || allowFallbackWhenForcedTls)) {
                        console.warn("[Redis] TLS handshake failed (ERR_SSL_WRONG_VERSION_NUMBER). Retrying with TLS disabled. " +
                            "Fix by setting REDIS_URL=redis://... (no TLS) or REDIS_TLS=false.");
                        try {
                            yield instance.disconnect();
                        }
                        catch (_b) {
                            // ignore
                        }
                        const retryTls = false;
                        const retryUrl = normalizeRedisScheme(REDIS_URL, retryTls);
                        const retryClient = (0, redis_1.createClient)(buildRedisConfig(retryUrl, retryTls, rejectUnauthorized));
                        retryClient.on("error", (e) => console.error("[Redis] Client error:", e));
                        yield retryClient.connect();
                        client = retryClient;
                        return retryClient;
                    }
                    throw err;
                }
            }
            catch (err) {
                console.error("[Redis] Failed to connect:", err);
                return null;
            }
            finally {
                initializing = null;
            }
        }))();
        return initializing;
    });
}
function getSessionKey(jti) {
    return `${getRedisPrefix("session")}${jti}`;
}
