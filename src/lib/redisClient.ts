import { createClient, RedisClientType } from "redis";

// Relax generics to avoid conflicts when optional Redis modules (graph/json) augment client types
type AnyRedisClient = RedisClientType<any, any, any>;

let client: AnyRedisClient | null = null;
let initializing: Promise<AnyRedisClient | null> | null = null;

const REDIS_URL = process.env.REDIS_URL;
const DEFAULT_REDIS_PREFIX = process.env.REDIS_PREFIX || "order-app";

const parseBoolean = (value: string | undefined): boolean | undefined => {
    if (value === undefined) return undefined;
    const lower = value.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
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

function buildRedisConfig(url: string, tlsEnabled: boolean, rejectUnauthorized: boolean) {
    const parsed = new URL(url);
    const socket: Record<string, unknown> = {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : undefined,
        tls: tlsEnabled,
        connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 5000,
        reconnectStrategy: (retries: number, cause: Error) => {
            // Stop reconnect loops on TLS-protocol mismatch so we can fall back cleanly.
            if (isSslWrongVersionError(cause)) return cause;
            return Math.min(retries * 50, 500);
        },
    };

    if (tlsEnabled) {
        socket.servername = parsed.hostname;
        socket.rejectUnauthorized = rejectUnauthorized;
    }

    return { url, socket };
}

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
            const tlsOverride = parseBoolean(process.env.REDIS_TLS);
            const urlWantsTls = REDIS_URL.startsWith("rediss://");
            const tlsEnabled = tlsOverride ?? urlWantsTls;

            const rejectUnauthorized = parseBoolean(process.env.REDIS_TLS_REJECT_UNAUTHORIZED) ?? false;
            const normalizedUrl = normalizeRedisScheme(REDIS_URL, tlsEnabled);

            const fallbackSetting = parseBoolean(process.env.REDIS_TLS_AUTO_FALLBACK);
            const autoTlsFallback = fallbackSetting ?? (process.env.NODE_ENV !== "production");
            const allowFallbackWhenForcedTls = fallbackSetting === true;

            const instance = createClient(buildRedisConfig(normalizedUrl, tlsEnabled, rejectUnauthorized));

            instance.on("error", (err) => {
                console.error("[Redis] Client error:", err);
            });

            try {
                await instance.connect();
                console.info("[Redis] Connected successfully");
                client = instance;
                return instance;
            } catch (err) {
                if (
                    autoTlsFallback &&
                    isSslWrongVersionError(err) &&
                    (tlsOverride === undefined || allowFallbackWhenForcedTls)
                ) {
                    console.warn(
                        "[Redis] TLS handshake failed (ERR_SSL_WRONG_VERSION_NUMBER). Retrying with TLS disabled. " +
                            "Fix by setting REDIS_URL=redis://... (no TLS) or REDIS_TLS=false."
                    );
                    try {
                        await instance.disconnect();
                    } catch {
                        // ignore
                    }

                    const retryTls = false;
                    const retryUrl = normalizeRedisScheme(REDIS_URL, retryTls);
                    const retryClient = createClient(buildRedisConfig(retryUrl, retryTls, rejectUnauthorized));
                    retryClient.on("error", (e) => console.error("[Redis] Client error:", e));
                    await retryClient.connect();
                    console.info("[Redis] Connected successfully (TLS disabled fallback)");
                    client = retryClient;
                    return retryClient;
                }

                throw err;
            }
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
