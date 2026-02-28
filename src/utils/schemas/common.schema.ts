import { z } from "zod";

export const uuid = z.string().uuid();
export const money = z.coerce.number().min(0);

export const paginationQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
        sort_created: z.enum(["old", "new"]).optional(),
        q: z.string().optional(),
        status: z.string().optional(),
        type: z.string().optional(),
        category_id: uuid.optional()
    }).passthrough()
});
