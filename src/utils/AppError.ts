import { ErrorCodes, ErrorCode } from './ApiResponse';

/**
 * Custom Application Error Class
 * Following supabase-postgres-best-practices for consistent error handling
 */
export class AppError extends Error {
    public statusCode: number;
    public status: string;
    public isOperational: boolean;
    public code?: ErrorCode;
    public details?: unknown;

    constructor(message: string, statusCode: number, code?: ErrorCode, details?: unknown) {
        super(message);

        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        this.code = code;
        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Factory methods for common error types
     */
    static badRequest(message: string, code?: ErrorCode): AppError {
        return new AppError(message, 400, code || ErrorCodes.VALIDATION_ERROR);
    }

    static unauthorized(message: string = 'Authentication required'): AppError {
        return new AppError(message, 401, ErrorCodes.UNAUTHORIZED);
    }

    static forbidden(message: string = 'Access denied'): AppError {
        return new AppError(message, 403, ErrorCodes.FORBIDDEN);
    }

    static notFound(resource: string = 'Resource'): AppError {
        return new AppError(`${resource} not found`, 404, ErrorCodes.NOT_FOUND);
    }

    static conflict(message: string = 'Resource already exists'): AppError {
        return new AppError(message, 409, ErrorCodes.CONFLICT);
    }

    static internal(message: string = 'Internal server error'): AppError {
        return new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
    }
}
