/**
 * Simple LRU Cache Implementation
 * Following supabase-postgres-best-practices: server-cache-lru
 * 
 * Use cases:
 * - Caching frequently accessed data (categories, units, etc.)
 * - Reducing database load for read-heavy operations
 * - Cross-request caching for static-ish data
 */
import { getRedisClient, getRedisPrefix } from "../lib/redisClient";

interface CacheEntry<T> {
    value: T;
    expiry: number;
}

interface CacheOptions {
    maxSize?: number;
    defaultTtl?: number; // Time to live in milliseconds
}

interface CacheTelemetryHooks {
    onHit?: (source: "memory" | "redis") => void;
    onMiss?: () => void;
    onStore?: () => void;
}

/**
 * LRU Cache with TTL support
 */
export class LRUCache<T> {
    private cache: Map<string, CacheEntry<T>>;
    private readonly maxSize: number;
    private readonly defaultTtl: number;

    constructor(options: CacheOptions = {}) {
        this.cache = new Map();
        this.maxSize = options.maxSize || 1000;
        this.defaultTtl = options.defaultTtl || 5 * 60 * 1000; // 5 minutes default
    }

    /**
     * Get value from cache
     * Returns undefined if not found or expired
     */
    get(key: string): T | undefined {
        const entry = this.cache.get(key);
        
        if (!entry) {
            return undefined;
        }

        // Check if expired
        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return undefined;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.value;
    }

    /**
     * Set value in cache with optional TTL
     */
    set(key: string, value: T, ttl?: number): void {
        // Remove oldest entries if at capacity
        while (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        const entry: CacheEntry<T> = {
            value,
            expiry: Date.now() + (ttl || this.defaultTtl),
        };

        this.cache.set(key, entry);
    }

    /**
     * Check if key exists and is not expired
     */
    has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    /**
     * Delete a specific key
     */
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Delete all keys matching a pattern (prefix)
     */
    invalidatePattern(pattern: string): number {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.startsWith(pattern)) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }

    /**
     * Clear entire cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    stats(): { size: number; maxSize: number } {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
        };
    }

    getDefaultTtl(): number {
        return this.defaultTtl;
    }
}

// Create singleton instances for different cache types
const cacheInstances: Record<string, LRUCache<unknown>> = {};

/**
 * Get or create a cache instance by name
 */
export function getCache<T>(name: string, options?: CacheOptions): LRUCache<T> {
    if (!cacheInstances[name]) {
        cacheInstances[name] = new LRUCache<T>(options);
    }
    return cacheInstances[name] as LRUCache<T>;
}

// Pre-configured cache instances
export const queryCache = getCache<unknown>('query', { 
    maxSize: 500, 
    defaultTtl: 2 * 60 * 1000  // 2 minutes
});

export const metadataCache = getCache<unknown>('metadata', { 
    maxSize: 100, 
    defaultTtl: 10 * 60 * 1000  // 10 minutes (for categories, units, etc.)
});

const redisCacheEnabled = process.env.REDIS_CACHE_ENABLED === "true";
const redisCachePrefix = getRedisPrefix("cache");
const redisScanCount = Number(process.env.REDIS_CACHE_SCAN_COUNT || 200);
const inFlightCacheFetches = new Map<string, Promise<unknown>>();

function toRedisCacheKey(key: string): string {
    return `${redisCachePrefix}${key}`;
}

async function readFromRedisCache<T>(key: string): Promise<T | undefined> {
    if (!redisCacheEnabled) return undefined;
    const redis = await getRedisClient();
    if (!redis) return undefined;

    const raw = await redis.get(toRedisCacheKey(key));
    if (!raw) return undefined;

    try {
        return JSON.parse(raw) as T;
    } catch {
        await redis.del(toRedisCacheKey(key));
        return undefined;
    }
}

async function writeToRedisCache<T>(key: string, value: T, ttlMs: number): Promise<void> {
    if (!redisCacheEnabled) return;
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.set(toRedisCacheKey(key), JSON.stringify(value), { PX: ttlMs });
}

async function invalidateRedisCache(patterns: string[]): Promise<void> {
    if (!redisCacheEnabled || patterns.length === 0) return;
    const redis = await getRedisClient();
    if (!redis) return;

    for (const pattern of patterns) {
        const match = `${toRedisCacheKey(pattern)}*`;
        // scanIterator is non-blocking and safe for large keyspaces
        for await (const key of redis.scanIterator({ MATCH: match, COUNT: redisScanCount })) {
            await redis.del(String(key));
        }
    }
}

/**
 * Cache decorator for async functions
 * Usage:
 * const getCachedData = withCache('key', () => fetchData(), 60000);
 */
export async function withCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
    cache: LRUCache<T> = queryCache as LRUCache<T>,
    hooks?: CacheTelemetryHooks
): Promise<T> {
    const effectiveTtl = ttl ?? cache.getDefaultTtl();
    const cached = cache.get(key);
    if (cached !== undefined) {
        hooks?.onHit?.("memory");
        return cached;
    }

    const redisCached = await readFromRedisCache<T>(key);
    if (redisCached !== undefined) {
        hooks?.onHit?.("redis");
        cache.set(key, redisCached, effectiveTtl);
        return redisCached;
    }

    const inFlight = inFlightCacheFetches.get(key) as Promise<T> | undefined;
    if (inFlight) {
        return inFlight;
    }

    hooks?.onMiss?.();
    const fetchPromise = (async () => {
        const value = await fetcher();
        cache.set(key, value, effectiveTtl);
        await writeToRedisCache(key, value, effectiveTtl);
        hooks?.onStore?.();
        return value;
    })().finally(() => {
        inFlightCacheFetches.delete(key);
    });

    inFlightCacheFetches.set(key, fetchPromise as Promise<unknown>);
    return fetchPromise;
}

/**
 * Generate cache key from parameters
 */
export function cacheKey(prefix: string, ...params: (string | number | boolean | undefined)[]): string {
    const sanitized = params
        .map(p => p === undefined ? '' : String(p))
        .join(':');
    return `${prefix}:${sanitized}`;
}

/**
 * Invalidate cache when data changes
 * Call this after create/update/delete operations
 */
export function invalidateCache(patterns: string[]): void {
    for (const pattern of patterns) {
        queryCache.invalidatePattern(pattern);
        metadataCache.invalidatePattern(pattern);
    }
    void invalidateRedisCache(patterns).catch((error) => {
        console.error("[Cache] Redis invalidation failed:", error);
    });
}

export default {
    LRUCache,
    getCache,
    queryCache,
    metadataCache,
    withCache,
    cacheKey,
    invalidateCache,
};
