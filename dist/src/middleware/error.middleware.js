"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = void 0;
const AppError_1 = require("../utils/AppError");
const ApiResponse_1 = require("../utils/ApiResponse");
const zod_1 = require("zod");
// Map common error types to error codes
function getErrorCode(err, statusCode) {
    if (err instanceof AppError_1.AppError && err.code) {
        return err.code;
    }
    // Map by status code
    switch (statusCode) {
        case 400: return ApiResponse_1.ErrorCodes.VALIDATION_ERROR;
        case 401: return ApiResponse_1.ErrorCodes.UNAUTHORIZED;
        case 403: return ApiResponse_1.ErrorCodes.FORBIDDEN;
        case 404: return ApiResponse_1.ErrorCodes.NOT_FOUND;
        case 409: return ApiResponse_1.ErrorCodes.CONFLICT;
        case 429: return ApiResponse_1.ErrorCodes.RATE_LIMITED;
        default: return ApiResponse_1.ErrorCodes.INTERNAL_ERROR;
    }
}
// Handle Zod validation errors
function handleZodError(err) {
    const fields = {};
    for (const issue of err.issues) {
        const path = issue.path.join('.') || 'value';
        if (!fields[path]) {
            fields[path] = [];
        }
        fields[path].push(issue.message);
    }
    return {
        message: 'Validation failed',
        details: { fields },
    };
}
// Handle database errors
function handleDatabaseError(err) {
    const errorMessage = err.message.toLowerCase();
    // PostgreSQL duplicate key violation
    if (errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
        return {
            code: ApiResponse_1.ErrorCodes.DUPLICATE_ENTRY,
            message: 'A record with this value already exists',
        };
    }
    // PostgreSQL foreign key violation
    if (errorMessage.includes('foreign key constraint')) {
        return {
            code: ApiResponse_1.ErrorCodes.VALIDATION_ERROR,
            message: 'Referenced record does not exist',
        };
    }
    return {
        code: ApiResponse_1.ErrorCodes.DATABASE_ERROR,
        message: 'Database operation failed',
    };
}
const globalErrorHandler = (err, req, res, _next) => {
    var _a;
    const isDev = process.env.NODE_ENV === 'development';
    // Default values
    let statusCode = 500;
    let errorCode = ApiResponse_1.ErrorCodes.INTERNAL_ERROR;
    let message = 'Something went wrong!';
    let details = undefined;
    // Handle AppError (our custom errors)
    if (err instanceof AppError_1.AppError) {
        statusCode = err.statusCode;
        errorCode = getErrorCode(err, statusCode);
        message = err.message;
    }
    // Handle Zod validation errors
    else if (err instanceof zod_1.ZodError) {
        statusCode = 400;
        errorCode = ApiResponse_1.ErrorCodes.VALIDATION_ERROR;
        const zodResult = handleZodError(err);
        message = zodResult.message;
        details = zodResult.details;
    }
    // Handle database errors
    else if (err.name === 'QueryFailedError' || err.message.includes('violates')) {
        statusCode = 409;
        const dbResult = handleDatabaseError(err);
        errorCode = dbResult.code;
        message = dbResult.message;
    }
    // Handle JWT errors
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        errorCode = ApiResponse_1.ErrorCodes.INVALID_TOKEN;
        message = 'Invalid authentication token';
    }
    else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        errorCode = ApiResponse_1.ErrorCodes.TOKEN_EXPIRED;
        message = 'Authentication token has expired';
    }
    // Handle CSRF errors
    else if (err.code === 'EBADCSRFTOKEN' || ((_a = err.message) === null || _a === void 0 ? void 0 : _a.includes('CSRF'))) {
        statusCode = 403;
        errorCode = ApiResponse_1.ErrorCodes.FORBIDDEN;
        message = 'Invalid CSRF token';
    }
    // Log error in development or for server errors
    if (isDev || statusCode >= 500) {
        console.error(`[ERROR ${statusCode}] ${errorCode}:`, err.message);
        if (isDev) {
            console.error(err.stack);
        }
    }
    // Build response
    const errorResponse = {
        code: errorCode,
        message,
    };
    if (details !== undefined) {
        errorResponse.details = details;
    }
    if (isDev && err.stack) {
        errorResponse.stack = err.stack;
    }
    const response = {
        success: false,
        error: errorResponse,
    };
    res.status(statusCode).json(response);
};
exports.globalErrorHandler = globalErrorHandler;
