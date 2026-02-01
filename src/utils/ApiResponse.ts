import { Response } from 'express';

/**
 * Standardized API Response Utilities
 * Following supabase-postgres-best-practices for consistent responses
 * 
 * Response Format:
 * Success: { success: true, data: T, meta?: { ... } }
 * Error: { success: false, error: { code: string, message: string, details?: any } }
 */

// Standard error codes for consistent client handling
export const ErrorCodes = {
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
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// Response interfaces
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: unknown;
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Send a successful response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: SuccessResponse<T>['meta']
): Response {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(meta && { meta }),
  };
  
  return res.status(statusCode).json(response);
}

/**
 * Send a paginated response
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  statusCode: number = 200
): Response {
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
export function sendError(
  res: Response,
  code: ErrorCode,
  message: string,
  statusCode: number = 500,
  details?: unknown
): Response {
  const errorResponse: ErrorResponse['error'] = {
    code,
    message,
  };
  
  if (details !== undefined) {
    errorResponse.details = details;
  }
  
  const response: ErrorResponse = {
    success: false,
    error: errorResponse,
  };
  
  return res.status(statusCode).json(response);
}

/**
 * Convenience methods for common responses
 */
export const ApiResponses = {
  // Success responses
  ok: <T>(res: Response, data: T, meta?: SuccessResponse<T>['meta']) => 
    sendSuccess(res, data, 200, meta),
    
  created: <T>(res: Response, data: T) => 
    sendSuccess(res, data, 201),
    
  noContent: (res: Response) => 
    res.status(204).send(),
    
  paginated: <T>(res: Response, data: T[], pagination: { page: number; limit: number; total: number }) =>
    sendPaginated(res, data, pagination),

  // Error responses
  badRequest: (res: Response, message: string = 'Invalid request', details?: unknown) =>
    sendError(res, ErrorCodes.VALIDATION_ERROR, message, 400, details),
    
  unauthorized: (res: Response, message: string = 'Authentication required') =>
    sendError(res, ErrorCodes.UNAUTHORIZED, message, 401),
    
  forbidden: (res: Response, message: string = 'Access denied') =>
    sendError(res, ErrorCodes.FORBIDDEN, message, 403),
    
  notFound: (res: Response, resource: string = 'Resource') =>
    sendError(res, ErrorCodes.NOT_FOUND, `${resource} not found`, 404),
    
  conflict: (res: Response, message: string = 'Resource already exists') =>
    sendError(res, ErrorCodes.CONFLICT, message, 409),
    
  tooManyRequests: (res: Response, message: string = 'Too many requests') =>
    sendError(res, ErrorCodes.RATE_LIMITED, message, 429),
    
  internalError: (res: Response, message: string = 'Internal server error', details?: unknown) =>
    sendError(res, ErrorCodes.INTERNAL_ERROR, message, 500, details),
    
  validationError: (res: Response, errors: Record<string, string[]>) =>
    sendError(res, ErrorCodes.VALIDATION_ERROR, 'Validation failed', 400, { fields: errors }),
};

export default ApiResponses;
