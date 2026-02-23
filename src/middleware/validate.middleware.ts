import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { ApiResponses, ErrorCodes } from "../utils/ApiResponse";

/**
 * Validation Middleware
 * Following supabase-postgres-best-practices:
 * - Standardized error responses
 * - Consistent validation error format
 */
export const validate = (schema: z.Schema) => (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        if (parsed && typeof parsed === "object") {
            const parsedRecord = parsed as Record<string, unknown>;
            if (Object.prototype.hasOwnProperty.call(parsedRecord, "body")) {
                req.body = parsedRecord.body;
            }
            if (Object.prototype.hasOwnProperty.call(parsedRecord, "query")) {
                req.query = parsedRecord.query as Request["query"];
            }
            if (Object.prototype.hasOwnProperty.call(parsedRecord, "params")) {
                req.params = parsedRecord.params as Request["params"];
            }
        }

        next();
    } catch (error) {
        if (error instanceof ZodError) {
            // Format validation errors
            const fields: Record<string, string[]> = {};
            for (const issue of error.issues) {
                const path = issue.path.join('.') || 'value';
                if (!fields[path]) {
                    fields[path] = [];
                }
                fields[path].push(issue.message);
            }
            
            return ApiResponses.validationError(res, fields);
        }
        return ApiResponses.badRequest(res, "Invalid request data");
    }
};
