"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const ApiResponse_1 = require("../utils/ApiResponse");
/**
 * Validation Middleware
 * Following supabase-postgres-best-practices:
 * - Standardized error responses
 * - Consistent validation error format
 */
const validate = (schema) => (req, res, next) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            // Format validation errors
            const fields = {};
            for (const issue of error.issues) {
                const path = issue.path.join('.') || 'value';
                if (!fields[path]) {
                    fields[path] = [];
                }
                fields[path].push(issue.message);
            }
            return ApiResponse_1.ApiResponses.validationError(res, fields);
        }
        return ApiResponse_1.ApiResponses.badRequest(res, "Invalid request data");
    }
};
exports.validate = validate;
