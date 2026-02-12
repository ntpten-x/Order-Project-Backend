import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

/**
 * Enhanced Rate Limiting Middleware
 * Different limits for different endpoint types
 */

const redisUrl = process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL;
let redisStoreFactory: ((prefix: string) => any) | undefined;

const loadRedisDeps = () => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const redis = require("redis");
        const createClient = redis?.createClient;
        if (!createClient) {
            return null;
        }
        return { createClient };
    } catch (err) {
        console.warn("[RateLimit] Redis deps not available. Install 'redis' to enable distributed rate limiting.");
        return null;
    }
};

const parseBoolean = (value: string | undefined) => {
    if (value === undefined) return undefined;
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
    return undefined;
};

const isSslWrongVersionError = (err: unknown): boolean => {
    if (!err || typeof err !== "object") return false;
    const anyErr = err as { code?: unknown; message?: unknown };
    if (anyErr.code === "ERR_SSL_WRONG_VERSION_NUMBER") return true;
    const msg = typeof anyErr.message === "string" ? anyErr.message : "";
    return msg.toLowerCase().includes("wrong version number");
};

const normalizeRedisScheme = (url: string, tlsEnabled: boolean) => {
    if (tlsEnabled) return url.replace(/^redis:/, "rediss:");
    return url.replace(/^rediss:/, "redis:");
};

const createRedisStore = (getRedisClient: () => any | null, prefix: string) => {
    let windowMs = 60 * 1000;
    const safePrefix = prefix.endsWith(":") ? prefix : `${prefix}:`;
    const withPrefix = (key: string) => `${safePrefix}${key}`;
    const logStoreError = (err: unknown) => {
        console.error("[RateLimit] Redis store error:", err);
    };

    // Fallback local store so rate limiting still works when Redis is misconfigured/unavailable.
    // This is process-local (not distributed) and behaves similarly to express-rate-limit's MemoryStore.
    const localHits = new Map<string, { totalHits: number; resetAt: number }>();
    const localGet = (key: string) => {
        const now = Date.now();
        const record = localHits.get(key);
        if (!record) return undefined;
        if (record.resetAt <= now) {
            localHits.delete(key);
            return undefined;
        }
        return { totalHits: record.totalHits, resetTime: new Date(record.resetAt) };
    };
    const localIncrement = (key: string) => {
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
    const localDecrement = (key: string) => {
        const record = localHits.get(key);
        if (!record) return;
        record.totalHits -= 1;
        if (record.totalHits <= 0) localHits.delete(key);
    };

    return {
        localKeys: false,
        prefix: safePrefix,
        init: (options: { windowMs?: number } | undefined) => {
            if (options?.windowMs) {
                windowMs = options.windowMs;
            }
        },
        get: async (key: string) => {
            try {
                const redisClient = getRedisClient();
                if (!redisClient) return localGet(key);
                const redisKey = withPrefix(key);
                const rawHits = await redisClient.get(redisKey);
                if (rawHits === null || rawHits === undefined) {
                    return localGet(key);
                }
                const totalHits = Number(rawHits);
                const ttlMs = Number(await redisClient.pTTL(redisKey));
                const resetTime = Number.isFinite(ttlMs) && ttlMs > 0 ? new Date(Date.now() + ttlMs) : undefined;
                return { totalHits, resetTime };
            } catch (err) {
                logStoreError(err);
                return localGet(key);
            }
        },
        increment: async (key: string) => {
            try {
                const redisClient = getRedisClient();
                if (!redisClient) return localIncrement(key);
                const redisKey = withPrefix(key);
                const now = Date.now();
                const totalHits = Number(await redisClient.incr(redisKey));
                let ttlMs = Number(await redisClient.pTTL(redisKey));
                if (!Number.isFinite(ttlMs) || ttlMs < 0) {
                    await redisClient.pExpire(redisKey, windowMs);
                    ttlMs = windowMs;
                }
                const resetTime = Number.isFinite(ttlMs) && ttlMs > 0 ? new Date(now + ttlMs) : undefined;
                return { totalHits, resetTime };
            } catch (err) {
                logStoreError(err);
                return localIncrement(key);
            }
        },
        decrement: async (key: string) => {
            try {
                const redisClient = getRedisClient();
                if (!redisClient) return localDecrement(key);
                const redisKey = withPrefix(key);
                const remaining = Number(await redisClient.decr(redisKey));
                if (!Number.isFinite(remaining) || remaining <= 0) {
                    await redisClient.del(redisKey);
                }
            } catch (err) {
                logStoreError(err);
                localDecrement(key);
            }
        },
        resetKey: async (key: string) => {
            try {
                const redisClient = getRedisClient();
                if (!redisClient) {
                    localHits.delete(key);
                    return;
                }
                await redisClient.del(withPrefix(key));
            } catch (err) {
                logStoreError(err);
                localHits.delete(key);
            }
        },
        shutdown: async () => {
            try {
                const redisClient = getRedisClient();
                if (redisClient) {
                    await redisClient.quit();
                }
            } catch (err) {
                // ignore shutdown errors
            }
        },
    };
};

if (redisUrl) {
    const deps = loadRedisDeps();
    if (deps) {
        const tlsOverride = parseBoolean(process.env.RATE_LIMIT_REDIS_TLS || process.env.REDIS_TLS);
        const tlsRejectUnauthorized = parseBoolean(
            process.env.RATE_LIMIT_REDIS_TLS_REJECT_UNAUTHORIZED || process.env.REDIS_TLS_REJECT_UNAUTHORIZED
        );
        const urlWantsTls = redisUrl.startsWith("rediss://");
        const tlsEnabled = tlsOverride ?? urlWantsTls;

        const parsed = new URL(redisUrl);
        const finalTls = tlsEnabled;
        const effectiveUrl = normalizeRedisScheme(redisUrl, finalTls);

        const socketOptions: Record<string, unknown> = {
            host: parsed.hostname,
            port: parsed.port ? Number(parsed.port) : undefined,
            tls: finalTls,
            connectTimeout: Number(process.env.RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS) || 5000,
            reconnectStrategy: (retries: number, cause: Error) => {
                // Stop reconnect loops on TLS-protocol mismatch so we can fall back cleanly.
                if (isSslWrongVersionError(cause)) return cause;
                return Math.min(retries * 50, 500);
            },
        };
        if (finalTls) {
            socketOptions.servername = parsed.hostname;
            socketOptions.rejectUnauthorized = tlsRejectUnauthorized ?? false;
        }

        let activeRedisClient: any | null = deps.createClient({ url: effectiveUrl, socket: socketOptions });

        const getActiveRedisClient = () => {
            const candidate = activeRedisClient;
            if (!candidate) return null;
            if (typeof candidate.isReady === "boolean" && candidate.isReady !== true) return null;
            return candidate;
        };

        const fallbackSetting = parseBoolean(
            process.env.RATE_LIMIT_REDIS_TLS_AUTO_FALLBACK || process.env.REDIS_TLS_AUTO_FALLBACK
        );
        const autoTlsFallback = fallbackSetting ?? (process.env.NODE_ENV !== "production");
        const allowFallbackWhenForcedTls = fallbackSetting === true;

        const connectWithTlsFallback = async () => {
            try {
                activeRedisClient.on("error", (err: unknown) => {
                    console.error("[RateLimit] Redis error:", err);
                });
                await activeRedisClient.connect();
                console.info("[RateLimit] Redis connected successfully");
            } catch (err) {
                if (
                    autoTlsFallback &&
                    finalTls === true &&
                    isSslWrongVersionError(err) &&
                    (tlsOverride === undefined || allowFallbackWhenForcedTls)
                ) {
                    console.warn(
                        "[RateLimit] Redis TLS handshake failed (ERR_SSL_WRONG_VERSION_NUMBER). Retrying with TLS disabled. " +
                            "Fix by setting RATE_LIMIT_REDIS_URL=redis://... (no TLS) or RATE_LIMIT_REDIS_TLS=false."
                    );
                    try {
                        await activeRedisClient.disconnect();
                    } catch {
                        // ignore
                    }

                    const retryTls = false;
                    const retryUrl = normalizeRedisScheme(redisUrl, retryTls);
                    const retrySocket: Record<string, unknown> = {
                        host: parsed.hostname,
                        port: parsed.port ? Number(parsed.port) : undefined,
                        tls: retryTls,
                        connectTimeout: Number(process.env.RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS) || 5000,
                        reconnectStrategy: (retries: number, cause: Error) => {
                            if (isSslWrongVersionError(cause)) return cause;
                            return Math.min(retries * 50, 500);
                        },
                    };
                    const retryClient = deps.createClient({ url: retryUrl, socket: retrySocket });
                    retryClient.on("error", (e: unknown) => console.error("[RateLimit] Redis error:", e));
                    await retryClient.connect();
                    console.info("[RateLimit] Redis connected successfully (TLS disabled fallback)");
                    activeRedisClient = retryClient;
                    return;
                }

                throw err;
            }
        };

        connectWithTlsFallback().catch((err: unknown) => {
            console.error("[RateLimit] Failed to connect to Redis:", err);
        });

        redisStoreFactory = (prefix: string) => createRedisStore(getActiveRedisClient, prefix);
    } else {
        console.warn("[RateLimit] Redis URL set but redis deps are missing. Falling back to in-memory store.");
    }
} else {
    console.warn("[RateLimit] Redis URL not set. Falling back to in-memory store (not suitable for multi-instance).");
}

const parsePositiveNumber = (value: string | undefined, fallback: number) => {
    if (!value) return fallback;
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

const getStore = (prefix: string) => (redisStoreFactory ? redisStoreFactory(prefix) : undefined);

const apiStore = getStore("rl:api");
const authStore = getStore("rl:auth");
const orderStore = getStore("rl:order");
const paymentStore = getStore("rl:payment");
const passwordStore = getStore("rl:password");

const apiSkipPaths = new Set(["/health", "/csrf-token", "/metrics"]);

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: apiWindowMs,
    max: apiMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again after 15 minutes",
    skip: (req) => apiSkipPaths.has(req.path),
    ...(apiStore ? { store: apiStore } : {}),
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many requests from this IP, please try again after 15 minutes"
            }
        });
    }
});

// Stricter limit for authentication endpoints
export const authLimiter = rateLimit({
    windowMs: authWindowMs,
    max: authMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many login attempts, please try again shortly",
    skipSuccessfulRequests: true, // Don't count successful requests
    ...(authStore ? { store: authStore } : {}),
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many login attempts, please try again after 15 minutes"
            }
        });
    }
});

// Stricter limit for order creation (prevent spam)
export const orderCreateLimiter = rateLimit({
    windowMs: orderWindowMs,
    max: orderMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many order creation attempts, please slow down",
    // Protect write-heavy order mutations, but do not throttle read endpoints such as /pos/orders/summary.
    skip: (req) => !["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase()),
    ...(orderStore ? { store: orderStore } : {}),
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many order creation attempts, please slow down"
            }
        });
    }
});

// Stricter limit for payment endpoints
export const paymentLimiter = rateLimit({
    windowMs: paymentWindowMs,
    max: paymentMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many payment attempts, please try again later",
    ...(paymentStore ? { store: paymentStore } : {}),
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many payment attempts, please try again later"
            }
        });
    }
});

// Very strict limit for password reset
export const passwordResetLimiter = rateLimit({
    windowMs: passwordResetWindowMs,
    max: passwordResetMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many password reset attempts, please try again later",
    ...(passwordStore ? { store: passwordStore } : {}),
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            success: false,
            error: {
                code: "RATE_LIMITED",
                message: "Too many password reset attempts, please try again later"
            }
        });
    }
});
