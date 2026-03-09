import { randomUUID } from "crypto";
import { NextFunction, Request, RequestHandler, Response } from "express";
import pinoHttp from "pino-http";
import { logger } from "../utils/logger";

const defaultSkipPaths = ["/health", "/metrics", "/csrf-token", "/system/health"];

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

function shouldSkipLogging(pathValue: string): boolean {
    const normalizedPath = normalizePath(pathValue);
    return httpLogSkipPaths.some((skipPath) => {
        if (skipPath === normalizedPath) return true;
        if (skipPath === "/") return normalizedPath === "/";
        return normalizedPath.startsWith(`${skipPath}/`);
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
            if (isLogged || shouldSkipLogging(req.path)) {
                return;
            }

            isLogged = true;
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
            const routePath = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
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

            (requestWithLogger.log ?? logger).info(payload, "request completed");
        };

        res.once("finish", () => writeLog("finish"));
        res.once("close", () => writeLog("close"));

        next();
    });
};
