import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

/**
 * Database Query Optimization Utilities
 * Following supabase-postgres-best-practices:
 * - query-missing-indexes: Use indexed columns in WHERE
 * - schema-partial-indexes: Use partial indexes for filtered queries
 * - lock-optimistic-locking: Prevent concurrent modification issues
 */

/**
 * Pagination helper with consistent format
 * Following: data-pagination patterns
 */
export interface PaginationParams {
    page: number;
    limit: number;
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    last_page: number;
    has_next: boolean;
    has_prev: boolean;
}

export async function paginate<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    params: PaginationParams
): Promise<PaginatedResult<T>> {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    // Use getManyAndCount for efficient single-query pagination
    const [data, total] = await query
        .skip(skip)
        .take(limit)
        .getManyAndCount();

    const last_page = Math.ceil(total / limit) || 1;

    return {
        data,
        total,
        page,
        last_page,
        has_next: page < last_page,
        has_prev: page > 1,
    };
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

/**
 * Date range filter helper
 * Following: query-date-range patterns
 */
export function addDateRangeFilter<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    startDate: Date | string | undefined,
    endDate: Date | string | undefined,
    column: string,
    alias: string
): SelectQueryBuilder<T> {
    if (startDate) {
        const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
        query.andWhere(`${alias}.${column} >= :startDate`, { startDate: start });
    }

    if (endDate) {
        const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
        query.andWhere(`${alias}.${column} <= :endDate`, { endDate: end });
    }

    return query;
}

/**
 * Sort helper with safe column validation
 * Prevents SQL injection through sort parameters
 */
export function addSortCondition<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    sortBy: string | undefined,
    sortOrder: 'ASC' | 'DESC' | undefined,
    allowedColumns: string[],
    alias: string,
    defaultSort: { column: string; order: 'ASC' | 'DESC' }
): SelectQueryBuilder<T> {
    const column = sortBy && allowedColumns.includes(sortBy) ? sortBy : defaultSort.column;
    const order = sortOrder === 'ASC' || sortOrder === 'DESC' ? sortOrder : defaultSort.order;
    
    return query.orderBy(`${alias}.${column}`, order);
}

/**
 * Build efficient select with only needed columns
 * Following: server-serialization - minimize data passed
 */
export function selectColumns<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    alias: string,
    columns: string[]
): SelectQueryBuilder<T> {
    const selectFields = columns.map(col => `${alias}.${col}`);
    return query.select(selectFields);
}

/**
 * Batch insert helper for bulk operations
 * More efficient than individual inserts
 */
export async function batchInsert<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    values: Partial<T>[],
    batchSize: number = 100
): Promise<void> {
    for (let i = 0; i < values.length; i += batchSize) {
        const batch = values.slice(i, i + batchSize);
        await query.insert().values(batch).execute();
    }
}

/**
 * Check if query would benefit from an index
 * Use in development to identify missing indexes
 */
export function suggestIndex(
    tableName: string,
    whereColumns: string[],
    orderColumns: string[] = []
): string {
    const allColumns = [...new Set([...whereColumns, ...orderColumns])];
    const indexName = `idx_${tableName}_${allColumns.join('_')}`;
    const columnList = allColumns.join(', ');
    
    return `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columnList});`;
}

export default {
    paginate,
    addSearchCondition,
    addFilterCondition,
    addBooleanFilter,
    addDateRangeFilter,
    addSortCondition,
    selectColumns,
    batchInsert,
    suggestIndex,
};
