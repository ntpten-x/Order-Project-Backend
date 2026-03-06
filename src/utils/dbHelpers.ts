import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

/**
 * Database Query Optimization Utilities
 * Following supabase-postgres-best-practices:
 * - query-missing-indexes: Use indexed columns in WHERE
 * - schema-partial-indexes: Use partial indexes for filtered queries
 * - lock-optimistic-locking: Prevent concurrent modification issues
 */

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    last_page: number;
    has_next: boolean;
    has_prev: boolean;
}

/**
 * Search helper that uses indexed columns efficiently
 * Following: query-search-patterns
 */
export function addSearchCondition<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    searchTerm: string | undefined,
    columns: string[],
    alias: string
): SelectQueryBuilder<T> {
    if (!searchTerm || !searchTerm.trim()) {
        return query;
    }

    const sanitized = searchTerm.trim();
    const conditions = columns.map(col => `${alias}.${col} ILIKE :searchTerm`);
    
    return query.andWhere(`(${conditions.join(' OR ')})`, {
        searchTerm: `%${sanitized}%`
    });
}

/**
 * Filter helper for common filter patterns
 */
export function addFilterCondition<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    value: unknown,
    column: string,
    alias: string,
    paramName?: string
): SelectQueryBuilder<T> {
    if (value === undefined || value === null || value === '') {
        return query;
    }

    const param = paramName || column.replace('.', '_');
    return query.andWhere(`${alias}.${column} = :${param}`, { [param]: value });
}

/**
 * Boolean filter helper
 */
export function addBooleanFilter<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    value: boolean | string | undefined,
    column: string,
    alias: string
): SelectQueryBuilder<T> {
    if (value === undefined || value === '') {
        return query;
    }

    const boolValue = value === true || value === 'true' || value === '1';
    return query.andWhere(`${alias}.${column} = :${column}`, { [column]: boolValue });
}

export default {
    addSearchCondition,
    addFilterCondition,
    addBooleanFilter,
};
