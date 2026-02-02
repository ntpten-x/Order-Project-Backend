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
exports.paginate = paginate;
exports.addSearchCondition = addSearchCondition;
exports.addFilterCondition = addFilterCondition;
exports.addBooleanFilter = addBooleanFilter;
exports.addDateRangeFilter = addDateRangeFilter;
exports.addSortCondition = addSortCondition;
exports.selectColumns = selectColumns;
exports.batchInsert = batchInsert;
exports.suggestIndex = suggestIndex;
function paginate(query, params) {
    return __awaiter(this, void 0, void 0, function* () {
        const { page, limit } = params;
        const skip = (page - 1) * limit;
        // Use getManyAndCount for efficient single-query pagination
        const [data, total] = yield query
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
    });
}
/**
 * Search helper that uses indexed columns efficiently
 * Following: query-search-patterns
 */
function addSearchCondition(query, searchTerm, columns, alias) {
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
function addFilterCondition(query, value, column, alias, paramName) {
    if (value === undefined || value === null || value === '') {
        return query;
    }
    const param = paramName || column.replace('.', '_');
    return query.andWhere(`${alias}.${column} = :${param}`, { [param]: value });
}
/**
 * Boolean filter helper
 */
function addBooleanFilter(query, value, column, alias) {
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
function addDateRangeFilter(query, startDate, endDate, column, alias) {
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
function addSortCondition(query, sortBy, sortOrder, allowedColumns, alias, defaultSort) {
    const column = sortBy && allowedColumns.includes(sortBy) ? sortBy : defaultSort.column;
    const order = sortOrder === 'ASC' || sortOrder === 'DESC' ? sortOrder : defaultSort.order;
    return query.orderBy(`${alias}.${column}`, order);
}
/**
 * Build efficient select with only needed columns
 * Following: server-serialization - minimize data passed
 */
function selectColumns(query, alias, columns) {
    const selectFields = columns.map(col => `${alias}.${col}`);
    return query.select(selectFields);
}
/**
 * Batch insert helper for bulk operations
 * More efficient than individual inserts
 */
function batchInsert(query_1, values_1) {
    return __awaiter(this, arguments, void 0, function* (query, values, batchSize = 100) {
        for (let i = 0; i < values.length; i += batchSize) {
            const batch = values.slice(i, i + batchSize);
            yield query.insert().values(batch).execute();
        }
    });
}
/**
 * Check if query would benefit from an index
 * Use in development to identify missing indexes
 */
function suggestIndex(tableName, whereColumns, orderColumns = []) {
    const allColumns = [...new Set([...whereColumns, ...orderColumns])];
    const indexName = `idx_${tableName}_${allColumns.join('_')}`;
    const columnList = allColumns.join(', ');
    return `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columnList});`;
}
exports.default = {
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
