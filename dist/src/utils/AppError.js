"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
const ApiResponse_1 = require("./ApiResponse");
/**
 * Custom Application Error Class
 * Following supabase-postgres-best-practices for consistent error handling
 */
class AppError extends Error {
    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
    /**
     * Factory methods for common error types
     */
    static badRequest(message, code) {
        return new AppError(message, 400, code || ApiResponse_1.ErrorCodes.VALIDATION_ERROR);
    }
    static unauthorized(message = 'Authentication required') {
        return new AppError(message, 401, ApiResponse_1.ErrorCodes.UNAUTHORIZED);
    }
    static forbidden(message = 'Access denied') {
        return new AppError(message, 403, ApiResponse_1.ErrorCodes.FORBIDDEN);
    }
    static notFound(resource = 'Resource') {
        return new AppError(`${resource} not found`, 404, ApiResponse_1.ErrorCodes.NOT_FOUND);
    }
    static conflict(message = 'Resource already exists') {
        return new AppError(message, 409, ApiResponse_1.ErrorCodes.CONFLICT);
    }
    static internal(message = 'Internal server error') {
        return new AppError(message, 500, ApiResponse_1.ErrorCodes.INTERNAL_ERROR);
    }
}
exports.AppError = AppError;
