import { getRedisClient, getRedisPrefix } from "../lib/redisClient";
import { metrics } from "./metrics";

export type CachedPermissionDecision = {
    effect: "allow" | "deny" | null;
    scope: "none" | "own" | "branch" | "all" | null;
} | null;

type CacheSource = "memory" | "redis" | "none";

type MemoryCacheEntry = {
    value: CachedPermissionDecision;
    expiresAt: number;
};

const configuredTtlMs = Number(process.env.PERMISSION_CACHE_TTL_MS ?? 0);
const configuredTtlSeconds = Number(process.env.PERMISSION_CACHE_TTL_SECONDS ?? 0);
const permissionCacheTtlMs =
    configuredTtlMs > 0
        ? configuredTtlMs
        : configuredTtlSeconds > 0
            ? configuredTtlSeconds * 1000
            : 5 * 60 * 1000;
const redisScanCount = Number(process.env.PERMISSION_CACHE_SCAN_COUNT || 200);
const redisPrefix = getRedisPrefix("permission-decision");
const memoryCache = new Map<string, MemoryCacheEntry>();

function makeCacheKey(userId: string, roleId: string, resourceKey: string, actionKey: string): string {
    const encodedResource = encodeURIComponent(resourceKey);
    const encodedAction = encodeURIComponent(actionKey);
    return `${userId}:${roleId}:${encodedResource}:${encodedAction}`;
}

function readMemory(key: string): CachedPermissionDecision | undefined {
    const hit = memoryCache.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
        memoryCache.delete(key);
        return undefined;
    }
    return hit.value;
}

function writeMemory(key: string, value: CachedPermissionDecision): void {
    memoryCache.set(key, {
        value,
        expiresAt: Date.now() + permissionCacheTtlMs,
    });
}

async function readRedis(key: string): Promise<CachedPermissionDecision | undefined> {
    try {
        const redis = await getRedisClient();
        if (!redis) return undefined;

        const raw = await redis.get(`${redisPrefix}${key}`);
        if (!raw) return undefined;

        try {
            return JSON.parse(raw) as CachedPermissionDecision;
        } catch {
            await redis.del(`${redisPrefix}${key}`);
            return undefined;
        }
    } catch (error) {
        console.warn("[PermissionCache] Redis read failed", {
            key,
            error,
        });
        return undefined;
    }
}

async function writeRedis(key: string, value: CachedPermissionDecision): Promise<void> {
    try {
        const redis = await getRedisClient();
        if (!redis) return;

        await redis.set(`${redisPrefix}${key}`, JSON.stringify(value), {
            PX: permissionCacheTtlMs,
        });
    } catch (error) {
        console.warn("[PermissionCache] Redis write failed", {
            key,
            error,
        });
    }
}

function observeCache(result: "hit" | "miss", source: CacheSource): void {
    metrics.observeCache({
        cache: "permission-decision",
        operation: "resolve",
        result,
        source,
    });
}

export async function resolvePermissionDecisionWithCache(input: {
    userId: string;
    roleId: string;
    resourceKey: string;
    actionKey: string;
    fetcher: () => Promise<CachedPermissionDecision>;
}): Promise<{ decision: CachedPermissionDecision; source: CacheSource }> {
    const key = makeCacheKey(input.userId, input.roleId, input.resourceKey, input.actionKey);

    const memoryHit = readMemory(key);
    if (memoryHit !== undefined) {
        observeCache("hit", "memory");
        return { decision: memoryHit, source: "memory" };
    }

    // Redis round-trips can dominate request latency in some deployments.
    // Permission reads are cheap from Postgres; prefer DB on miss and keep Redis writes best-effort.
    observeCache("miss", "none");
    const fetched = await input.fetcher();
    writeMemory(key, fetched);
    void writeRedis(key, fetched);
    return { decision: fetched, source: "none" };
}

export async function invalidatePermissionDecisionCacheByUser(userId: string): Promise<void> {
    const prefix = `${userId}:`;
    for (const key of memoryCache.keys()) {
        if (key.startsWith(prefix)) {
            memoryCache.delete(key);
        }
    }

    try {
        const redis = await getRedisClient();
        if (!redis) return;
        const pattern = `${redisPrefix}${prefix}*`;
        for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: redisScanCount })) {
            await redis.del(String(key));
        }
    } catch (error) {
        console.warn("[PermissionCache] Redis user invalidation failed", {
            userId,
            error,
        });
    }
}

export async function invalidateAllPermissionDecisionCache(): Promise<void> {
    memoryCache.clear();

    try {
        const redis = await getRedisClient();
        if (!redis) return;
        const pattern = `${redisPrefix}*`;
        for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: redisScanCount })) {
            await redis.del(String(key));
        }
    } catch (error) {
        console.warn("[PermissionCache] Redis global invalidation failed", { error });
    }
}

export function clearPermissionDecisionMemoryCache(): void {
    memoryCache.clear();
}
