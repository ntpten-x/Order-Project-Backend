import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { ErrorCodes, ErrorCode } from '../utils/ApiResponse';
import { ZodError } from 'zod';

/**
 * Global Error Handler Middleware
 * Following supabase-postgres-best-practices for consistent error responses
 * 
 * Response Format:
 * { success: false, error: { code: string, message: string, details?: any } }
 */

interface ErrorResponse {
    success: false;
    error: {
        code: ErrorCode;
        message: string;
        details?: unknown;
        stack?: string;
    };
}

// Map common error types to error codes
function getErrorCode(err: Error | AppError, statusCode: number): ErrorCode {
    if (err instanceof AppError && err.code) {
        return err.code as ErrorCode;
    }

    // Map by status code
    switch (statusCode) {
        case 400: return ErrorCodes.VALIDATION_ERROR;
        case 401: return ErrorCodes.UNAUTHORIZED;
        case 403: return ErrorCodes.FORBIDDEN;
        case 404: return ErrorCodes.NOT_FOUND;
        case 409: return ErrorCodes.CONFLICT;
        case 429: return ErrorCodes.RATE_LIMITED;
        default: return ErrorCodes.INTERNAL_ERROR;
    }
}

// Handle Zod validation errors
function handleZodError(err: ZodError): { message: string; details: unknown } {
    const fields: Record<string, string[]> = {};

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
function handleDatabaseError(err: Error): { code: ErrorCode; message: string } {
    const errorMessage = err.message.toLowerCase();

    // PostgreSQL duplicate key violation
    if (errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
        return {
            code: ErrorCodes.DUPLICATE_ENTRY,
            message: 'A record with this value already exists',
        };
    }

    // PostgreSQL foreign key violation
    if (errorMessage.includes('foreign key constraint')) {
        return {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Referenced record does not exist',
        };
    }

    return {
        code: ErrorCodes.DATABASE_ERROR,
        message: 'Database operation failed',
    };
}

export const globalErrorHandler = (
    err: Error | AppError | ZodError,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    const isDev = process.env.NODE_ENV === 'development';

    // Default values
    let statusCode = 500;
    let errorCode: ErrorCode = ErrorCodes.INTERNAL_ERROR;
    let message = 'Something went wrong!';
    let details: unknown = undefined;

    // Handle AppError (our custom errors)
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        errorCode = getErrorCode(err, statusCode);
        message = err.message;
    }
    // Handle Zod validation errors
    else if (err instanceof ZodError) {
        statusCode = 400;
        errorCode = ErrorCodes.VALIDATION_ERROR;
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
        errorCode = ErrorCodes.INVALID_TOKEN;
        message = 'Invalid authentication token';
    }
    else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        errorCode = ErrorCodes.TOKEN_EXPIRED;
        message = 'Authentication token has expired';
    }
    // Handle CSRF errors
    else if ((err as any).code === 'EBADCSRFTOKEN' || err.message?.includes('CSRF')) {
        statusCode = 403;
        errorCode = ErrorCodes.FORBIDDEN;
        message = 'Invalid CSRF token';
    }

    // Log error in development or for server errors
    if (isDev || statusCode >= 500) {
        console.error(`[ERROR ${statusCode}] ${errorCode}:`, err.message);
        if (isDev) {
            console.error(err.stack);
            // In development, show the real error message instead of generic one
            if (message === 'Something went wrong!') {
                message = err.message;
            }
        }
    }

    // Build response
    const errorResponse: ErrorResponse['error'] = {
        code: errorCode,
        message,
    };

    if (details !== undefined) {
        errorResponse.details = details;
    }

    if (isDev && err.stack) {
        errorResponse.stack = err.stack;
    }

    const response: ErrorResponse = {
        success: false,
        error: errorResponse,
    };

    res.status(statusCode).json(response);
};
