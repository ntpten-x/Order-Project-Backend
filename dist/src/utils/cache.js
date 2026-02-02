"use strict";
/**
 * Simple LRU Cache Implementation
 * Following supabase-postgres-best-practices: server-cache-lru
 *
 * Use cases:
 * - Caching frequently accessed data (categories, units, etc.)
 * - Reducing database load for read-heavy operations
 * - Cross-request caching for static-ish data
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataCache = exports.queryCache = exports.LRUCache = void 0;
exports.getCache = getCache;
exports.withCache = withCache;
exports.cacheKey = cacheKey;
exports.invalidateCache = invalidateCache;
/**
 * LRU Cache with TTL support
 */
class LRUCache {
    constructor(options = {}) {
        this.cache = new Map();
        this.maxSize = options.maxSize || 1000;
        this.defaultTtl = options.defaultTtl || 5 * 60 * 1000; // 5 minutes default
    }
    /**
     * Get value from cache
     * Returns undefined if not found or expired
     */
    get(key) {
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
    set(key, value, ttl) {
        // Remove oldest entries if at capacity
        while (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }
        const entry = {
            value,
            expiry: Date.now() + (ttl || this.defaultTtl),
        };
        this.cache.set(key, entry);
    }
    /**
     * Check if key exists and is not expired
     */
    has(key) {
        return this.get(key) !== undefined;
    }
    /**
     * Delete a specific key
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Delete all keys matching a pattern (prefix)
     */
    invalidatePattern(pattern) {
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
    clear() {
        this.cache.clear();
    }
    /**
     * Get cache statistics
     */
    stats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
        };
    }
}
exports.LRUCache = LRUCache;
// Create singleton instances for different cache types
const cacheInstances = {};
/**
 * Get or create a cache instance by name
 */
function getCache(name, options) {
    if (!cacheInstances[name]) {
        cacheInstances[name] = new LRUCache(options);
    }
    return cacheInstances[name];
}
// Pre-configured cache instances
exports.queryCache = getCache('query', {
    maxSize: 500,
    defaultTtl: 2 * 60 * 1000 // 2 minutes
});
exports.metadataCache = getCache('metadata', {
    maxSize: 100,
    defaultTtl: 10 * 60 * 1000 // 10 minutes (for categories, units, etc.)
});
/**
 * Cache decorator for async functions
 * Usage:
 * const getCachedData = withCache('key', () => fetchData(), 60000);
 */
function withCache(key_1, fetcher_1, ttl_1) {
    return __awaiter(this, arguments, void 0, function* (key, fetcher, ttl, cache = exports.queryCache) {
        const cached = cache.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const value = yield fetcher();
        cache.set(key, value, ttl);
        return value;
    });
}
/**
 * Generate cache key from parameters
 */
function cacheKey(prefix, ...params) {
    const sanitized = params
        .map(p => p === undefined ? '' : String(p))
        .join(':');
    return `${prefix}:${sanitized}`;
}
/**
 * Invalidate cache when data changes
 * Call this after create/update/delete operations
 */
function invalidateCache(patterns) {
    for (const pattern of patterns) {
        exports.queryCache.invalidatePattern(pattern);
        exports.metadataCache.invalidatePattern(pattern);
    }
}
exports.default = {
    LRUCache,
    getCache,
    queryCache: exports.queryCache,
    metadataCache: exports.metadataCache,
    withCache,
    cacheKey,
    invalidateCache,
};
