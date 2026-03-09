import "reflect-metadata";
import { AppDataSource, connectDatabase } from "../../database/database";
import { closeSharedBullMqConnection } from "../bullmq.connection";
import { createPosBackgroundWorker } from "./posBackground.worker";

async function bootstrap(): Promise<void> {
    await connectDatabase();

    const worker = createPosBackgroundWorker();
    console.info("[BullMQ] POS background worker started");

    const shutdown = async (signal: string) => {
        console.info(`[BullMQ] Shutting down worker on ${signal}`);

        try {
            await worker.close();
            await closeSharedBullMqConnection();

            if (AppDataSource.isInitialized) {
                await AppDataSource.destroy();
            }
        } catch (error) {
            console.error("[BullMQ] Error during worker shutdown", error);
        } finally {
            process.exit(0);
        }
    };

    process.once("SIGINT", () => {
        void shutdown("SIGINT");
    });

    process.once("SIGTERM", () => {
        void shutdown("SIGTERM");
    });
}

void bootstrap().catch((error) => {
    console.error("[BullMQ] Worker bootstrap failed", error);
    process.exit(1);
});
