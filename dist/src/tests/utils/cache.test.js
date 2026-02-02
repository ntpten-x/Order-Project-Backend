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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const cache_1 = require("../../utils/cache");
(0, vitest_1.describe)('Cache Utilities', () => {
    (0, vitest_1.beforeEach)(() => {
        cache_1.queryCache.clear();
    });
    (0, vitest_1.describe)('LRUCache', () => {
        (0, vitest_1.it)('should store and retrieve values', () => {
            const cache = new cache_1.LRUCache({ maxSize: 10 });
            cache.set('key1', 'value1');
            (0, vitest_1.expect)(cache.get('key1')).toBe('value1');
        });
        (0, vitest_1.it)('should return undefined for non-existent keys', () => {
            const cache = new cache_1.LRUCache({ maxSize: 10 });
            (0, vitest_1.expect)(cache.get('nonexistent')).toBeUndefined();
        });
        (0, vitest_1.it)('should expire values after TTL', () => __awaiter(void 0, void 0, void 0, function* () {
            const cache = new cache_1.LRUCache({ maxSize: 10, defaultTtl: 100 });
            cache.set('key1', 'value1', 50);
            (0, vitest_1.expect)(cache.get('key1')).toBe('value1');
            yield new Promise(resolve => setTimeout(resolve, 60));
            (0, vitest_1.expect)(cache.get('key1')).toBeUndefined();
        }));
        (0, vitest_1.it)('should evict oldest entries when at capacity', () => {
            const cache = new cache_1.LRUCache({ maxSize: 2 });
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');
            (0, vitest_1.expect)(cache.get('key1')).toBeUndefined();
            (0, vitest_1.expect)(cache.get('key2')).toBe('value2');
            (0, vitest_1.expect)(cache.get('key3')).toBe('value3');
        });
    });
    (0, vitest_1.describe)('withCache', () => {
        (0, vitest_1.it)('should cache function results', () => __awaiter(void 0, void 0, void 0, function* () {
            let callCount = 0;
            const expensiveFunction = () => __awaiter(void 0, void 0, void 0, function* () {
                callCount++;
                return 'result';
            });
            const cachedFn = () => (0, cache_1.withCache)('test-key', expensiveFunction, 1000);
            const result1 = yield cachedFn();
            const result2 = yield cachedFn();
            (0, vitest_1.expect)(result1).toBe('result');
            (0, vitest_1.expect)(result2).toBe('result');
            (0, vitest_1.expect)(callCount).toBe(1); // Should only call once
        }));
        (0, vitest_1.it)('should return fresh data after cache expires', () => __awaiter(void 0, void 0, void 0, function* () {
            let callCount = 0;
            const expensiveFunction = () => __awaiter(void 0, void 0, void 0, function* () {
                callCount++;
                return `result-${callCount}`;
            });
            const cachedFn = () => (0, cache_1.withCache)('test-key-2', expensiveFunction, 50);
            const result1 = yield cachedFn();
            yield new Promise(resolve => setTimeout(resolve, 60));
            const result2 = yield cachedFn();
            (0, vitest_1.expect)(result1).toBe('result-1');
            (0, vitest_1.expect)(result2).toBe('result-2');
            (0, vitest_1.expect)(callCount).toBe(2);
        }));
    });
    (0, vitest_1.describe)('cacheKey', () => {
        (0, vitest_1.it)('should generate consistent cache keys', () => {
            const key1 = (0, cache_1.cacheKey)('prefix', 'param1', 'param2', 123);
            const key2 = (0, cache_1.cacheKey)('prefix', 'param1', 'param2', 123);
            (0, vitest_1.expect)(key1).toBe(key2);
        });
        (0, vitest_1.it)('should handle undefined parameters', () => {
            const key = (0, cache_1.cacheKey)('prefix', 'param1', undefined, 'param3');
            (0, vitest_1.expect)(key).toContain('prefix');
            (0, vitest_1.expect)(key).toContain('param1');
            (0, vitest_1.expect)(key).toContain('param3');
        });
    });
});
