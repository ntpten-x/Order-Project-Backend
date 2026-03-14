import { randomUUID } from "crypto";
import { NextFunction, Request, RequestHandler, Response } from "express";
import pinoHttp from "pino-http";
import { logger } from "../utils/logger";

const defaultSkipPaths = [
    "/health",
    "/metrics",
    "/csrf-token",
    "/system/health",
    "/pos/orders/summary",
    "/pos/orders/stats",
];

function parsePathList(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizePath(pathValue: string): string {
    if (!pathValue) return "/";
    const trimmed = pathValue.trim();
    if (!trimmed) return "/";
    if (trimmed === "/") return "/";
    return trimmed.endsWith("/") ? trimmed.slice(0, -1) || "/" : trimmed;
}

const configuredSkipPaths = parsePathList(process.env.HTTP_LOG_SKIP_PATHS);
const httpLogSkipPaths = (configuredSkipPaths.length > 0 ? configuredSkipPaths : defaultSkipPaths).map((pathValue) =>
    normalizePath(pathValue)
);
const defaultNoisyPaths = ["/pos/orders/summary", "/pos/orders/stats"];
const configuredNoisyPaths = parsePathList(process.env.HTTP_LOG_NOISY_PATHS);
const noisyLogPaths = (configuredNoisyPaths.length > 0 ? configuredNoisyPaths : defaultNoisyPaths).map((pathValue) =>
    normalizePath(pathValue)
);
const noisySuccessSampleRateRaw = Number(process.env.HTTP_LOG_NOISY_SUCCESS_SAMPLE_RATE || 0.02);
const noisySuccessSampleRate = Math.min(Math.max(noisySuccessSampleRateRaw, 0), 1);
const noisySuccessSlowMs = Math.max(0, Number(process.env.HTTP_LOG_NOISY_SLOW_MS || 250));

function shouldSkipLogging(pathValue: string): boolean {
    const normalizedPath = normalizePath(pathValue);
    return httpLogSkipPaths.some((skipPath) => {
        if (skipPath === normalizedPath) return true;
        if (skipPath === "/") return normalizedPath === "/";
        return normalizedPath.startsWith(`${skipPath}/`);
    });
}

function isNoisyLogPath(pathValue: string): boolean {
    const normalizedPath = normalizePath(pathValue);
    return noisyLogPaths.some((noisyPath) => {
        if (noisyPath === normalizedPath) return true;
        if (noisyPath === "/") return normalizedPath === "/";
        return normalizedPath.startsWith(`${noisyPath}/`);
    });
}

const pinoHttpMiddleware = pinoHttp({
    logger,
    autoLogging: false,
    quietReqLogger: true,
    quietResLogger: true,
    genReqId(req, res) {
        const headerValue = req.headers["x-request-id"];
        const requestId = typeof headerValue === "string" && headerValue.trim()
            ? headerValue.trim()
            : randomUUID();
        res.setHeader("x-request-id", requestId);
        return requestId;
    },
});

export const httpLogger: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    (pinoHttpMiddleware as any)(req, res, (err?: unknown) => {
        if (err) {
            return next(err);
        }
        const requestWithLogger = req as Request & { id?: string | number; log?: typeof logger };

        const startedAt = process.hrtime.bigint();
        let isLogged = false;

        const writeLog = (event: "finish" | "close") => {
            const routePath = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
            if (isLogged || shouldSkipLogging(routePath)) {
                return;
            }

            isLogged = true;
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
            const user = (req as any).user;
            const branchId = (req as any).branchId || user?.branch_id;
            const payload = {
                requestId: requestWithLogger.id,
                method: req.method,
                path: req.originalUrl || req.url,
                routePath,
                statusCode: res.statusCode,
                responseTimeMs: Number(durationMs.toFixed(1)),
                ip: req.ip,
                userAgent: req.get("user-agent"),
                userId: user?.id,
                branchId,
                event,
            };
            const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
            const shouldSampleNoisySuccess =
                isSuccess &&
                isNoisyLogPath(routePath) &&
                durationMs < noisySuccessSlowMs &&
                noisySuccessSampleRate < 1 &&
                Math.random() > noisySuccessSampleRate;

            if (event === "close" && !res.writableEnded) {
                (requestWithLogger.log ?? logger).warn(payload, "request aborted");
                return;
            }

            if (res.statusCode >= 500) {
                (requestWithLogger.log ?? logger).error(payload, "request completed with server error");
                return;
            }

            if (res.statusCode >= 400) {
                (requestWithLogger.log ?? logger).warn(payload, "request completed with client error");
                return;
            }

            if (shouldSampleNoisySuccess) {
                return;
            }

            (requestWithLogger.log ?? logger).info(payload, "request completed");
        };

        res.once("finish", () => writeLog("finish"));
        res.once("close", () => writeLog("close"));

        next();
    });
};
