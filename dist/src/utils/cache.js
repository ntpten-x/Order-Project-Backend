"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataCache = exports.queryCache = exports.LRUCache = void 0;
exports.getCache = getCache;
exports.withCache = withCache;
exports.cacheKey = cacheKey;
exports.invalidateCache = invalidateCache;
/**
 * Simple LRU Cache Implementation
 * Following supabase-postgres-best-practices: server-cache-lru
 *
 * Use cases:
 * - Caching frequently accessed data (categories, units, etc.)
 * - Reducing database load for read-heavy operations
 * - Cross-request caching for static-ish data
 */
const redisClient_1 = require("../lib/redisClient");
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
    getDefaultTtl() {
        return this.defaultTtl;
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
const redisCacheEnabled = process.env.REDIS_CACHE_ENABLED === "true";
const redisCachePrefix = (0, redisClient_1.getRedisPrefix)("cache");
const redisScanCount = Number(process.env.REDIS_CACHE_SCAN_COUNT || 200);
function toRedisCacheKey(key) {
    return `${redisCachePrefix}${key}`;
}
function readFromRedisCache(key) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!redisCacheEnabled)
            return undefined;
        const redis = yield (0, redisClient_1.getRedisClient)();
        if (!redis)
            return undefined;
        const raw = yield redis.get(toRedisCacheKey(key));
        if (!raw)
            return undefined;
        try {
            return JSON.parse(raw);
        }
        catch (_a) {
            yield redis.del(toRedisCacheKey(key));
            return undefined;
        }
    });
}
function writeToRedisCache(key, value, ttlMs) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!redisCacheEnabled)
            return;
        const redis = yield (0, redisClient_1.getRedisClient)();
        if (!redis)
            return;
        yield redis.set(toRedisCacheKey(key), JSON.stringify(value), { PX: ttlMs });
    });
}
function invalidateRedisCache(patterns) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        if (!redisCacheEnabled || patterns.length === 0)
            return;
        const redis = yield (0, redisClient_1.getRedisClient)();
        if (!redis)
            return;
        for (const pattern of patterns) {
            const match = `${toRedisCacheKey(pattern)}*`;
            try {
                // scanIterator is non-blocking and safe for large keyspaces
                for (var _d = true, _e = (e_1 = void 0, __asyncValues(redis.scanIterator({ MATCH: match, COUNT: redisScanCount }))), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const key = _c;
                    yield redis.del(String(key));
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
    });
}
/**
 * Cache decorator for async functions
 * Usage:
 * const getCachedData = withCache('key', () => fetchData(), 60000);
 */
function withCache(key_1, fetcher_1, ttl_1) {
    return __awaiter(this, arguments, void 0, function* (key, fetcher, ttl, cache = exports.queryCache) {
        const effectiveTtl = ttl !== null && ttl !== void 0 ? ttl : cache.getDefaultTtl();
        const cached = cache.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const redisCached = yield readFromRedisCache(key);
        if (redisCached !== undefined) {
            cache.set(key, redisCached, effectiveTtl);
            return redisCached;
        }
        const value = yield fetcher();
        cache.set(key, value, effectiveTtl);
        yield writeToRedisCache(key, value, effectiveTtl);
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
    void invalidateRedisCache(patterns).catch((error) => {
        console.error("[Cache] Redis invalidation failed:", error);
    });
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
