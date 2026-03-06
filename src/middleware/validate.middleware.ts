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
                const nextQuery = parsedRecord.query as Request["query"];

                // Express may expose req.query as a getter-only property in some runtime combinations.
                // Prefer mutating the existing query object instead of reassigning the property.
                if (req.query && typeof req.query === "object") {
                    const queryTarget = req.query as Record<string, unknown>;
                    for (const key of Object.keys(queryTarget)) {
                        delete queryTarget[key];
                    }
                    Object.assign(queryTarget, nextQuery as Record<string, unknown>);
                } else {
                    // Fallback for environments where req.query is unexpectedly absent.
                    Object.defineProperty(req, "query", {
                        value: nextQuery,
                        configurable: true,
                        enumerable: true,
                        writable: true,
                    });
                }
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
