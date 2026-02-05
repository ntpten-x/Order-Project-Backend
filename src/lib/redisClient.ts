import { createClient, RedisClientType } from "redis";

// Relax generics to avoid conflicts when optional Redis modules (graph/json) augment client types
type AnyRedisClient = RedisClientType<any, any, any>;

let client: AnyRedisClient | null = null;
let initializing: Promise<AnyRedisClient | null> | null = null;

const REDIS_URL = process.env.REDIS_URL;
const DEFAULT_REDIS_PREFIX = process.env.REDIS_PREFIX || "order-app";

export function getRedisPrefix(namespace: string): string {
    return `${DEFAULT_REDIS_PREFIX}:${namespace}:`;
}

export async function getRedisClient(): Promise<AnyRedisClient | null> {
    if (!REDIS_URL) {
        return null;
    }

    if (client) return client;
    if (initializing) return initializing;

    initializing = (async (): Promise<AnyRedisClient | null> => {
        try {
            const instance = createClient({
                url: REDIS_URL,
                socket: {
                    tls: REDIS_URL.startsWith("rediss://"),
                },
            });

            instance.on("error", (err) => {
                console.error("[Redis] Client error:", err);
            });

            await instance.connect();
            client = instance;
            return instance;
        } catch (err) {
            console.error("[Redis] Failed to connect:", err);
            return null;
        } finally {
            initializing = null;
        }
    })();

    return initializing;
}

export function getSessionKey(jti: string): string {
    return `${getRedisPrefix("session")}${jti}`;
}
