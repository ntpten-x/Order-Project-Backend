import { getDbContext } from "../../database/dbContext";
import { cacheKey } from "../../utils/cache";

const TABLES_CACHE_PREFIX = "tables";

export function getTableCacheInvalidationPatterns(branchId?: string, id?: string): string[] {
    const ctx = getDbContext();
    const effectiveBranchId = branchId ?? ctx?.branchId;

    if (!effectiveBranchId) {
        return [`${TABLES_CACHE_PREFIX}:`];
    }

    const scopes: Array<Array<string>> = [
        ["branch", effectiveBranchId],
        ["admin"],
        ["public"],
    ];
    const patterns: string[] = [];

    for (const scope of scopes) {
        patterns.push(cacheKey(TABLES_CACHE_PREFIX, ...scope, "list"));
        patterns.push(cacheKey(TABLES_CACHE_PREFIX, ...scope, "name"));
        if (id) {
            patterns.push(cacheKey(TABLES_CACHE_PREFIX, ...scope, "single", id));
        }
    }

    return patterns;
}
