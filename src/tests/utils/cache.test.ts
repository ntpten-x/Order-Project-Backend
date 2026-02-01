import { describe, it, expect, beforeEach } from 'vitest';
import { LRUCache, withCache, cacheKey, invalidateCache, queryCache } from '../../utils/cache';

describe('Cache Utilities', () => {
    beforeEach(() => {
        queryCache.clear();
    });

    describe('LRUCache', () => {
        it('should store and retrieve values', () => {
            const cache = new LRUCache<string>({ maxSize: 10 });
            cache.set('key1', 'value1');
            
            expect(cache.get('key1')).toBe('value1');
        });

        it('should return undefined for non-existent keys', () => {
            const cache = new LRUCache<string>({ maxSize: 10 });
            
            expect(cache.get('nonexistent')).toBeUndefined();
        });

        it('should expire values after TTL', async () => {
            const cache = new LRUCache<string>({ maxSize: 10, defaultTtl: 100 });
            cache.set('key1', 'value1', 50);
            
            expect(cache.get('key1')).toBe('value1');
            
            await new Promise(resolve => setTimeout(resolve, 60));
            
            expect(cache.get('key1')).toBeUndefined();
        });

        it('should evict oldest entries when at capacity', () => {
            const cache = new LRUCache<string>({ maxSize: 2 });
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');
            
            expect(cache.get('key1')).toBeUndefined();
            expect(cache.get('key2')).toBe('value2');
            expect(cache.get('key3')).toBe('value3');
        });
    });

    describe('withCache', () => {
        it('should cache function results', async () => {
            let callCount = 0;
            const expensiveFunction = async () => {
                callCount++;
                return 'result';
            };

            const cachedFn = () => withCache('test-key', expensiveFunction, 1000);

            const result1 = await cachedFn();
            const result2 = await cachedFn();

            expect(result1).toBe('result');
            expect(result2).toBe('result');
            expect(callCount).toBe(1); // Should only call once
        });

        it('should return fresh data after cache expires', async () => {
            let callCount = 0;
            const expensiveFunction = async () => {
                callCount++;
                return `result-${callCount}`;
            };

            const cachedFn = () => withCache('test-key-2', expensiveFunction, 50);

            const result1 = await cachedFn();
            await new Promise(resolve => setTimeout(resolve, 60));
            const result2 = await cachedFn();

            expect(result1).toBe('result-1');
            expect(result2).toBe('result-2');
            expect(callCount).toBe(2);
        });
    });

    describe('cacheKey', () => {
        it('should generate consistent cache keys', () => {
            const key1 = cacheKey('prefix', 'param1', 'param2', 123);
            const key2 = cacheKey('prefix', 'param1', 'param2', 123);
            
            expect(key1).toBe(key2);
        });

        it('should handle undefined parameters', () => {
            const key = cacheKey('prefix', 'param1', undefined, 'param3');
            
            expect(key).toContain('prefix');
            expect(key).toContain('param1');
            expect(key).toContain('param3');
        });
    });
});
