import Redis from "ioredis";
import { resolveRedisConfig } from "../lib/redisClient";

export type BullMqConnectionRole = "queue" | "worker" | "events";

let sharedQueueConnection: Redis | null = null;

function buildBullMqConnection(role: BullMqConnectionRole): Redis {
    const resolved = resolveRedisConfig(process.env.REDIS_URL);
    if (!resolved) {
        throw new Error("BullMQ requires Redis. Set REDIS_URL before using queues/workers.");
    }

    const parsed = new URL(resolved.normalizedUrl);
    const useTls = parsed.protocol === "rediss:";
    const connectTimeout = Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 5000;
    const reconnectBaseMs = Number(process.env.BULLMQ_REDIS_RECONNECT_BASE_MS) || 500;
    const reconnectMaxMs = Number(process.env.BULLMQ_REDIS_RECONNECT_MAX_MS) || 5000;

    const client = new Redis(resolved.normalizedUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        connectTimeout,
        connectionName: `bullmq-${role}`,
        ...(useTls
            ? {
                tls: {
                    servername: parsed.hostname,
                    rejectUnauthorized: resolved.rejectUnauthorized,
                },
            }
            : {}),
        retryStrategy: (attempt: number) => Math.min(reconnectBaseMs * Math.max(attempt, 1), reconnectMaxMs),
    });

    client.on("error", (error) => {
        console.error(`[BullMQ:${role}] Redis error`, error);
    });

    client.on("reconnecting", (delay: number) => {
        console.warn(`[BullMQ:${role}] Redis reconnecting in ${delay}ms`);
    });

    client.on("ready", () => {
        console.info(`[BullMQ:${role}] Redis ready`);
    });

    return client;
}

export function getSharedBullMqConnection(): Redis {
    if (!sharedQueueConnection) {
        sharedQueueConnection = buildBullMqConnection("queue");
    }

    return sharedQueueConnection;
}

export function createBullMqWorkerConnection(): Redis {
    return buildBullMqConnection("worker");
}

export async function closeSharedBullMqConnection(): Promise<void> {
    if (!sharedQueueConnection) return;

    const connection = sharedQueueConnection;
    sharedQueueConnection = null;

    try {
        await connection.quit();
    } catch {
        connection.disconnect();
    }
}
