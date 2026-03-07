import pino, { Logger, LoggerOptions } from "pino";

const environment = process.env.NODE_ENV || "development";
const isProduction = environment === "production";
const serviceName = (process.env.APP_NAME || "order-backend").trim() || "order-backend";
const level = (process.env.LOG_LEVEL || (isProduction ? "info" : "debug")).trim() || "info";

const loggerOptions: LoggerOptions = {
    name: serviceName,
    level,
    base: {
        service: serviceName,
        env: environment,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level(label) {
            return { level: label };
        },
    },
    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.headers.x-api-key",
            "req.body.password",
            "req.body.password_confirmation",
            "req.body.token",
            "req.body.accessToken",
            "req.body.refreshToken",
            "req.body.csrfToken",
            "res.headers['set-cookie']",
        ],
        censor: "[Redacted]",
    },
    serializers: {
        err: pino.stdSerializers.err,
    },
};

const developmentTransport = !isProduction
    ? pino.transport({
        target: "pino-pretty",
        options: {
            colorize: true,
            singleLine: false,
            translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
            ignore: "pid,hostname",
        },
    })
    : undefined;

export const logger: Logger = developmentTransport
    ? pino(loggerOptions, developmentTransport)
    : pino(loggerOptions);

export function createLogger(bindings: Record<string, unknown>): Logger {
    return logger.child(bindings);
}

export function toError(value: unknown): Error {
    if (value instanceof Error) {
        return value;
    }

    if (typeof value === "string") {
        return new Error(value);
    }

    return new Error("Unknown error");
}
