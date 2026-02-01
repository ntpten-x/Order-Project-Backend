/**
 * Simple LRU Cache Implementation
 * Following supabase-postgres-best-practices: server-cache-lru
 * 
 * Use cases:
 * - Caching frequently accessed data (categories, units, etc.)
 * - Reducing database load for read-heavy operations
 * - Cross-request caching for static-ish data
 */

interface CacheEntry<T> {
    value: T;
    expiry: number;
}

interface CacheOptions {
    maxSize?: number;
    defaultTtl?: number; // Time to live in milliseconds
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

/**
 * Cache decorator for async functions
 * Usage:
 * const getCachedData = withCache('key', () => fetchData(), 60000);
 */
export async function withCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
    cache: LRUCache<T> = queryCache as LRUCache<T>
): Promise<T> {
    const cached = cache.get(key);
    if (cached !== undefined) {
        return cached;
    }

    const value = await fetcher();
    cache.set(key, value, ttl);
    return value;
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
