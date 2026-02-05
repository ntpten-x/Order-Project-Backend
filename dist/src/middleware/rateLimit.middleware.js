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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordResetLimiter = exports.paymentLimiter = exports.orderCreateLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
/**
 * Enhanced Rate Limiting Middleware
 * Different limits for different endpoint types
 */
const redisUrl = process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL;
let redisStoreFactory;
const loadRedisDeps = () => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const redis = require("redis");
        const createClient = redis === null || redis === void 0 ? void 0 : redis.createClient;
        if (!createClient) {
            return null;
        }
        return { createClient };
    }
    catch (err) {
        console.warn("[RateLimit] Redis deps not available. Install 'redis' to enable distributed rate limiting.");
        return null;
    }
};
const parseBoolean = (value) => {
    if (value === undefined)
        return undefined;
    if (value.toLowerCase() === "true")
        return true;
    if (value.toLowerCase() === "false")
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
const createRedisStore = (getRedisClient, prefix) => {
    let windowMs = 60 * 1000;
    const safePrefix = prefix.endsWith(":") ? prefix : `${prefix}:`;
    const withPrefix = (key) => `${safePrefix}${key}`;
    const logStoreError = (err) => {
        console.error("[RateLimit] Redis store error:", err);
    };
    // Fallback local store so rate limiting still works when Redis is misconfigured/unavailable.
    // This is process-local (not distributed) and behaves similarly to express-rate-limit's MemoryStore.
    const localHits = new Map();
    const localGet = (key) => {
        const now = Date.now();
        const record = localHits.get(key);
        if (!record)
            return undefined;
        if (record.resetAt <= now) {
            localHits.delete(key);
            return undefined;
        }
        return { totalHits: record.totalHits, resetTime: new Date(record.resetAt) };
    };
    const localIncrement = (key) => {
        const now = Date.now();
        const record = localHits.get(key);
        if (!record || record.resetAt <= now) {
            const resetAt = now + windowMs;
            localHits.set(key, { totalHits: 1, resetAt });
            return { totalHits: 1, resetTime: new Date(resetAt) };
        }
        record.totalHits += 1;
        return { totalHits: record.totalHits, resetTime: new Date(record.resetAt) };
    };
    const localDecrement = (key) => {
        const record = localHits.get(key);
        if (!record)
            return;
        record.totalHits -= 1;
        if (record.totalHits <= 0)
            localHits.delete(key);
    };
    return {
        localKeys: false,
        prefix: safePrefix,
        init: (options) => {
            if (options === null || options === void 0 ? void 0 : options.windowMs) {
                windowMs = options.windowMs;
            }
        },
        get: (key) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const redisClient = getRedisClient();
                if (!redisClient)
                    return localGet(key);
                const redisKey = withPrefix(key);
                const rawHits = yield redisClient.get(redisKey);
                if (rawHits === null || rawHits === undefined) {
                    return localGet(key);
                }
                const totalHits = Number(rawHits);
                const ttlMs = Number(yield redisClient.pTTL(redisKey));
                const resetTime = Number.isFinite(ttlMs) && ttlMs > 0 ? new Date(Date.now() + ttlMs) : undefined;
                return { totalHits, resetTime };
            }
            catch (err) {
                logStoreError(err);
                return localGet(key);
            }
        }),
        increment: (key) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const redisClient = getRedisClient();
                if (!redisClient)
                    return localIncrement(key);
                const redisKey = withPrefix(key);
                const now = Date.now();
                const totalHits = Number(yield redisClient.incr(redisKey));
                let ttlMs = Number(yield redisClient.pTTL(redisKey));
                if (!Number.isFinite(ttlMs) || ttlMs < 0) {
                    yield redisClient.pExpire(redisKey, windowMs);
                    ttlMs = windowMs;
                }
                const resetTime = Number.isFinite(ttlMs) && ttlMs > 0 ? new Date(now + ttlMs) : undefined;
                return { totalHits, resetTime };
            }
            catch (err) {
                logStoreError(err);
                return localIncrement(key);
            }
        }),
        decrement: (key) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const redisClient = getRedisClient();
                if (!redisClient)
                    return localDecrement(key);
                const redisKey = withPrefix(key);
                const remaining = Number(yield redisClient.decr(redisKey));
                if (!Number.isFinite(remaining) || remaining <= 0) {
                    yield redisClient.del(redisKey);
                }
            }
            catch (err) {
                logStoreError(err);
                localDecrement(key);
            }
        }),
        resetKey: (key) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const redisClient = getRedisClient();
                if (!redisClient) {
                    localHits.delete(key);
                    return;
                }
                yield redisClient.del(withPrefix(key));
            }
            catch (err) {
                logStoreError(err);
                localHits.delete(key);
            }
        }),
        shutdown: () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const redisClient = getRedisClient();
                if (redisClient) {
                    yield redisClient.quit();
                }
            }
            catch (err) {
                // ignore shutdown errors
            }
        }),
    };
};
if (redisUrl) {
    const deps = loadRedisDeps();
    if (deps) {
        const tlsOverride = parseBoolean(process.env.RATE_LIMIT_REDIS_TLS || process.env.REDIS_TLS);
        const tlsRejectUnauthorized = parseBoolean(process.env.RATE_LIMIT_REDIS_TLS_REJECT_UNAUTHORIZED || process.env.REDIS_TLS_REJECT_UNAUTHORIZED);
        const urlWantsTls = redisUrl.startsWith("rediss://");
        const tlsEnabled = tlsOverride !== null && tlsOverride !== void 0 ? tlsOverride : urlWantsTls;
        const parsed = new URL(redisUrl);
        const finalTls = tlsEnabled;
        const effectiveUrl = normalizeRedisScheme(redisUrl, finalTls);
        const socketOptions = {
            host: parsed.hostname,
            port: parsed.port ? Number(parsed.port) : undefined,
            tls: finalTls,
            connectTimeout: Number(process.env.RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS) || 5000,
            reconnectStrategy: (retries, cause) => {
                // Stop reconnect loops on TLS-protocol mismatch so we can fall back cleanly.
                if (isSslWrongVersionError(cause))
                    return cause;
                return Math.min(retries * 50, 500);
            },
        };
        if (finalTls) {
            socketOptions.servername = parsed.hostname;
            socketOptions.rejectUnauthorized = tlsRejectUnauthorized !== null && tlsRejectUnauthorized !== void 0 ? tlsRejectUnauthorized : false;
        }
        let activeRedisClient = deps.createClient({ url: effectiveUrl, socket: socketOptions });
        const getActiveRedisClient = () => {
            const candidate = activeRedisClient;
            if (!candidate)
                return null;
            if (typeof candidate.isReady === "boolean" && candidate.isReady !== true)
                return null;
            return candidate;
        };
        const fallbackSetting = parseBoolean(process.env.RATE_LIMIT_REDIS_TLS_AUTO_FALLBACK || process.env.REDIS_TLS_AUTO_FALLBACK);
        const autoTlsFallback = fallbackSetting !== null && fallbackSetting !== void 0 ? fallbackSetting : (process.env.NODE_ENV !== "production");
        const allowFallbackWhenForcedTls = fallbackSetting === true;
        const connectWithTlsFallback = () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                activeRedisClient.on("error", (err) => {
                    console.error("[RateLimit] Redis error:", err);
                });
                yield activeRedisClient.connect();
            }
            catch (err) {
                if (autoTlsFallback &&
                    finalTls === true &&
                    isSslWrongVersionError(err) &&
                    (tlsOverride === undefined || allowFallbackWhenForcedTls)) {
                    console.warn("[RateLimit] Redis TLS handshake failed (ERR_SSL_WRONG_VERSION_NUMBER). Retrying with TLS disabled. " +
                        "Fix by setting RATE_LIMIT_REDIS_URL=redis://... (no TLS) or RATE_LIMIT_REDIS_TLS=false.");
                    try {
                        yield activeRedisClient.disconnect();
                    }
                    catch (_a) {
                        // ignore
                    }
                    const retryTls = false;
                    const retryUrl = normalizeRedisScheme(redisUrl, retryTls);
                    const retrySocket = {
                        host: parsed.hostname,
                        port: parsed.port ? Number(parsed.port) : undefined,
                        tls: retryTls,
                        connectTimeout: Number(process.env.RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS) || 5000,
                        reconnectStrategy: (retries, cause) => {
                            if (isSslWrongVersionError(cause))
                                return cause;
                            return Math.min(retries * 50, 500);
                        },
                    };
                    const retryClient = deps.createClient({ url: retryUrl, socket: retrySocket });
                    retryClient.on("error", (e) => console.error("[RateLimit] Redis error:", e));
                    yield retryClient.connect();
                    activeRedisClient = retryClient;
                    return;
                }
                throw err;
            }
        });
        connectWithTlsFallback().catch((err) => {
            console.error("[RateLimit] Failed to connect to Redis:", err);
        });
        redisStoreFactory = (prefix) => createRedisStore(getActiveRedisClient, prefix);
    }
    else {
        console.warn("[RateLimit] Redis URL set but redis deps are missing. Falling back to in-memory store.");
    }
}
else {
    console.warn("[RateLimit] Redis URL not set. Falling back to in-memory store (not suitable for multi-instance).");
}
const parsePositiveNumber = (value, fallback) => {
    if (!value)
        return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const apiWindowMs = parsePositiveNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const apiMax = parsePositiveNumber(process.env.RATE_LIMIT_MAX, 1000);
const authWindowMs = parsePositiveNumber(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60 * 1000);
const authMax = parsePositiveNumber(process.env.RATE_LIMIT_AUTH_MAX, 20);
const orderWindowMs = parsePositiveNumber(process.env.RATE_LIMIT_ORDER_WINDOW_MS, 1 * 60 * 1000);
const orderMax = parsePositiveNumber(process.env.RATE_LIMIT_ORDER_MAX, 30);
const paymentWindowMs = parsePositiveNumber(process.env.RATE_LIMIT_PAYMENT_WINDOW_MS, 5 * 60 * 1000);
const paymentMax = parsePositiveNumber(process.env.RATE_LIMIT_PAYMENT_MAX, 50);
const passwordResetWindowMs = parsePositiveNumber(process.env.RATE_LIMIT_PASSWORD_RESET_WINDOW_MS, 60 * 60 * 1000);
const passwordResetMax = parsePositiveNumber(process.env.RATE_LIMIT_PASSWORD_RESET_MAX, 5);
const getStore = (prefix) => (redisStoreFactory ? redisStoreFactory(prefix) : undefined);
const apiStore = getStore("rl:api");
const authStore = getStore("rl:auth");
const orderStore = getStore("rl:order");
const paymentStore = getStore("rl:payment");
const passwordStore = getStore("rl:password");
const apiSkipPaths = new Set(["/health", "/csrf-token", "/metrics"]);
// General API rate limiter
exports.apiLimiter = (0, express_rate_limit_1.default)(Object.assign(Object.assign({ windowMs: apiWindowMs, max: apiMax, standardHeaders: true, legacyHeaders: false, message: "Too many requests from this IP, please try again after 15 minutes", skip: (req) => apiSkipPaths.has(req.path) }, (apiStore ? { store: apiStore } : {})), { handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many requests from this IP, please try again after 15 minutes"
            }
        });
    } }));
// Stricter limit for authentication endpoints
exports.authLimiter = (0, express_rate_limit_1.default)(Object.assign(Object.assign({ windowMs: authWindowMs, max: authMax, standardHeaders: true, legacyHeaders: false, message: "Too many login attempts, please try again shortly", skipSuccessfulRequests: true }, (authStore ? { store: authStore } : {})), { handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many login attempts, please try again after 15 minutes"
            }
        });
    } }));
// Stricter limit for order creation (prevent spam)
exports.orderCreateLimiter = (0, express_rate_limit_1.default)(Object.assign(Object.assign({ windowMs: orderWindowMs, max: orderMax, standardHeaders: true, legacyHeaders: false, message: "Too many order creation attempts, please slow down" }, (orderStore ? { store: orderStore } : {})), { handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many order creation attempts, please slow down"
            }
        });
    } }));
// Stricter limit for payment endpoints
exports.paymentLimiter = (0, express_rate_limit_1.default)(Object.assign(Object.assign({ windowMs: paymentWindowMs, max: paymentMax, standardHeaders: true, legacyHeaders: false, message: "Too many payment attempts, please try again later" }, (paymentStore ? { store: paymentStore } : {})), { handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many payment attempts, please try again later"
            }
        });
    } }));
// Very strict limit for password reset
exports.passwordResetLimiter = (0, express_rate_limit_1.default)(Object.assign(Object.assign({ windowMs: passwordResetWindowMs, max: passwordResetMax, standardHeaders: true, legacyHeaders: false, message: "Too many password reset attempts, please try again later" }, (passwordStore ? { store: passwordStore } : {})), { handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many password reset attempts, please try again later"
            }
        });
    } }));
