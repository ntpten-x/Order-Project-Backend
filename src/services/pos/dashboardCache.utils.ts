import { getDbContext } from "../../database/dbContext";
import { cacheKey } from "../../utils/cache";

const DASHBOARD_SALES_CACHE_PREFIX = "dashboard:sales";
const DASHBOARD_TOP_ITEMS_CACHE_PREFIX = "dashboard:top-items";
const DASHBOARD_OVERVIEW_CACHE_PREFIX = "dashboard:overview";

export function getDashboardCacheInvalidationPatterns(branchId?: string): string[] {
    const ctx = getDbContext();
    const effectiveBranchId = branchId ?? ctx?.branchId;

    if (!effectiveBranchId) {
        return [
            `${DASHBOARD_SALES_CACHE_PREFIX}:`,
            `${DASHBOARD_TOP_ITEMS_CACHE_PREFIX}:`,
            `${DASHBOARD_OVERVIEW_CACHE_PREFIX}:`,
        ];
    }

    const scopes: Array<Array<string>> = [
        ["branch", effectiveBranchId],
        ["admin"],
        ["public"],
    ];
    const patterns: string[] = [];

    for (const scope of scopes) {
        patterns.push(cacheKey(DASHBOARD_SALES_CACHE_PREFIX, ...scope));
        patterns.push(cacheKey(DASHBOARD_TOP_ITEMS_CACHE_PREFIX, ...scope));
        patterns.push(cacheKey(DASHBOARD_OVERVIEW_CACHE_PREFIX, ...scope));
    }

    return patterns;
}
