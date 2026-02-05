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

const createRedisStore = (redisClient: any, prefix: string) => {
    let windowMs = 60 * 1000;
    const safePrefix = prefix.endsWith(":") ? prefix : `${prefix}:`;
    const withPrefix = (key: string) => `${safePrefix}${key}`;

    return {
        localKeys: false,
        prefix: safePrefix,
        init: (options: { windowMs?: number } | undefined) => {
            if (options?.windowMs) {
                windowMs = options.windowMs;
            }
        },
        get: async (key: string) => {
            const redisKey = withPrefix(key);
            const results = await redisClient.multi().get(redisKey).pttl(redisKey).exec();
            const rawHits = results?.[0];
            if (rawHits === null || rawHits === undefined) {
                return undefined;
            }
            const totalHits = Number(rawHits);
            const ttlMs = Number(results?.[1] ?? -1);
            const resetTime = Number.isFinite(ttlMs) && ttlMs > 0 ? new Date(Date.now() + ttlMs) : undefined;
            return { totalHits, resetTime };
        },
        increment: async (key: string) => {
            const redisKey = withPrefix(key);
            const now = Date.now();
            const results = await redisClient.multi().incr(redisKey).pttl(redisKey).exec();
            const totalHits = Number(results?.[0] ?? 0);
            let ttlMs = Number(results?.[1] ?? -1);
            if (!Number.isFinite(ttlMs) || ttlMs < 0) {
                await redisClient.pexpire(redisKey, windowMs);
                ttlMs = windowMs;
            }
            const resetTime = Number.isFinite(ttlMs) && ttlMs > 0 ? new Date(now + ttlMs) : undefined;
            return { totalHits, resetTime };
        },
        decrement: async (key: string) => {
            const redisKey = withPrefix(key);
            const remaining = Number(await redisClient.decr(redisKey));
            if (!Number.isFinite(remaining) || remaining <= 0) {
                await redisClient.del(redisKey);
            }
        },
        resetKey: async (key: string) => {
            await redisClient.del(withPrefix(key));
        },
        shutdown: async () => {
            try {
                await redisClient.quit();
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
        const effectiveUrl = tlsEnabled ? redisUrl : redisUrl.replace(/^rediss:/, "redis:");
        const socketOptions = tlsEnabled
            ? { tls: true, rejectUnauthorized: tlsRejectUnauthorized ?? false }
            : undefined;

        const redisClient = deps.createClient(
            socketOptions ? { url: effectiveUrl, socket: socketOptions } : { url: effectiveUrl }
        );
        redisClient.on("error", (err: unknown) => {
            console.error("[RateLimit] Redis error:", err);
        });
        redisClient.connect().catch((err: unknown) => {
            console.error("[RateLimit] Failed to connect to Redis:", err);
        });
        redisStoreFactory = (prefix: string) => createRedisStore(redisClient, prefix);
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

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: apiWindowMs,
    max: apiMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again after 15 minutes",
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
