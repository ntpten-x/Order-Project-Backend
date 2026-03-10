import { cacheKey, invalidateLocalCache } from "../../utils/cache";
import { getDashboardCacheInvalidationPatterns } from "./dashboardCache.utils";
import { bumpReadModelVersion } from "./readModelVersion.utils";

const ORDER_LIST_CACHE_PREFIX = "orders:list";
const ORDER_SUMMARY_CACHE_PREFIX = "orders:summary";
const ORDER_STATS_CACHE_PREFIX = "orders:stats";

export function getOrderReadCacheInvalidationPatterns(branchId?: string): string[] {
    const scopes: Array<Array<string>> = branchId
        ? [
            ["branch", branchId],
            ["admin"],
            ["public"],
        ]
        : [
            ["admin"],
            ["public"],
        ];

    const patterns: string[] = [];
    for (const scope of scopes) {
        patterns.push(cacheKey(ORDER_LIST_CACHE_PREFIX, ...scope));
        patterns.push(cacheKey(ORDER_SUMMARY_CACHE_PREFIX, ...scope));
        patterns.push(cacheKey(ORDER_STATS_CACHE_PREFIX, ...scope));
    }

    patterns.push(...getDashboardCacheInvalidationPatterns(branchId));
    return patterns;
}

export function invalidateOrderReadCaches(branchId?: string): void {
    invalidateLocalCache(getOrderReadCacheInvalidationPatterns(branchId));
}

export async function bumpOrderReadModelVersions(branchId?: string): Promise<void> {
    const tasks = [
        bumpReadModelVersion("orders"),
        bumpReadModelVersion("dashboard"),
    ];

    if (branchId) {
        tasks.push(bumpReadModelVersion("orders", branchId));
        tasks.push(bumpReadModelVersion("dashboard", branchId));
    }

    await Promise.allSettled(tasks);
}
