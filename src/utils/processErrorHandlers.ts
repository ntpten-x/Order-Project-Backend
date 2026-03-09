import { Server } from "http";
import { logger, toError } from "./logger";

type ProcessErrorHandlerOptions = {
    server?: Server;
    shutdownTimeoutMs?: number;
    exitOnFatal?: boolean;
};

let isRegistered = false;
let isShuttingDown = false;

function closeServer(server?: Server): Promise<void> {
    if (!server || !server.listening) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

export function registerProcessErrorHandlers(options: ProcessErrorHandlerOptions = {}): void {
    if (isRegistered) {
        return;
    }

    isRegistered = true;
    const shutdownTimeoutMs = Number(process.env.LOGGER_SHUTDOWN_TIMEOUT_MS || options.shutdownTimeoutMs || 10000);
    const exitOnFatal = options.exitOnFatal ?? process.env.NODE_ENV !== "test";

    const handleFatalError = async (event: "uncaughtException" | "unhandledRejection", reason: unknown) => {
        if (isShuttingDown) {
            logger.error({ event }, "fatal process handler already running");
            return;
        }

        isShuttingDown = true;
        const error = toError(reason);
        logger.fatal({ err: error, event }, "fatal process error");

        const forcedExitTimer = setTimeout(() => {
            logger.fatal({ event, shutdownTimeoutMs }, "forcing process exit after fatal error timeout");
            if (exitOnFatal) {
                process.exit(1);
            }
        }, shutdownTimeoutMs);
        forcedExitTimer.unref();

        try {
            await closeServer(options.server);
            logger.info({ event }, "http server closed after fatal process error");
        } catch (shutdownError) {
            logger.error({ err: toError(shutdownError), event }, "error while closing http server");
        } finally {
            clearTimeout(forcedExitTimer);
            if (exitOnFatal) {
                process.exit(1);
            }
            isShuttingDown = false;
        }
    };

    process.on("uncaughtException", (error) => {
        void handleFatalError("uncaughtException", error);
    });

    process.on("unhandledRejection", (reason) => {
        void handleFatalError("unhandledRejection", reason);
    });
}
