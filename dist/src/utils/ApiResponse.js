"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponses = exports.ErrorCodes = void 0;
exports.sendSuccess = sendSuccess;
exports.sendPaginated = sendPaginated;
exports.sendError = sendError;
/**
 * Standardized API Response Utilities
 * Following supabase-postgres-best-practices for consistent responses
 *
 * Response Format:
 * Success: { success: true, data: T, meta?: { ... } }
 * Error: { success: false, error: { code: string, message: string, details?: any } }
 */
// Standard error codes for consistent client handling
exports.ErrorCodes = {
    // Validation errors (400)
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    // Authentication errors (401)
    UNAUTHORIZED: 'UNAUTHORIZED',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    // Authorization errors (403)
    FORBIDDEN: 'FORBIDDEN',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    // Not found errors (404)
    NOT_FOUND: 'NOT_FOUND',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    // Conflict errors (409)
    CONFLICT: 'CONFLICT',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
    // Rate limit errors (429)
    RATE_LIMITED: 'RATE_LIMITED',
    // Server errors (500)
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};
/**
 * Send a successful response
 */
function sendSuccess(res, data, statusCode = 200, meta) {
    const response = Object.assign({ success: true, data }, (meta && { meta }));
    return res.status(statusCode).json(response);
}
/**
 * Send a paginated response
 */
function sendPaginated(res, data, pagination, statusCode = 200) {
    const totalPages = Math.ceil(pagination.total / pagination.limit);
    return sendSuccess(res, data, statusCode, {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages,
    });
}
/**
 * Send an error response
 */
function sendError(res, code, message, statusCode = 500, details) {
    const errorResponse = {
        code,
        message,
    };
    if (details !== undefined) {
        errorResponse.details = details;
    }
    const response = {
        success: false,
        error: errorResponse,
    };
    return res.status(statusCode).json(response);
}
/**
 * Convenience methods for common responses
 */
exports.ApiResponses = {
    // Success responses
    ok: (res, data, meta) => sendSuccess(res, data, 200, meta),
    created: (res, data) => sendSuccess(res, data, 201),
    noContent: (res) => res.status(204).send(),
    paginated: (res, data, pagination) => sendPaginated(res, data, pagination),
    // Error responses
    badRequest: (res, message = 'Invalid request', details) => sendError(res, exports.ErrorCodes.VALIDATION_ERROR, message, 400, details),
    unauthorized: (res, message = 'Authentication required') => sendError(res, exports.ErrorCodes.UNAUTHORIZED, message, 401),
    forbidden: (res, message = 'Access denied') => sendError(res, exports.ErrorCodes.FORBIDDEN, message, 403),
    notFound: (res, resource = 'Resource') => sendError(res, exports.ErrorCodes.NOT_FOUND, `${resource} not found`, 404),
    conflict: (res, message = 'Resource already exists') => sendError(res, exports.ErrorCodes.CONFLICT, message, 409),
    tooManyRequests: (res, message = 'Too many requests') => sendError(res, exports.ErrorCodes.RATE_LIMITED, message, 429),
    internalError: (res, message = 'Internal server error', details) => sendError(res, exports.ErrorCodes.INTERNAL_ERROR, message, 500, details),
    validationError: (res, errors) => sendError(res, exports.ErrorCodes.VALIDATION_ERROR, 'Validation failed', 400, { fields: errors }),
};
exports.default = exports.ApiResponses;
