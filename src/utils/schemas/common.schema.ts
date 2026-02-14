import { z } from "zod";

export const uuid = z.string().uuid();
export const money = z.coerce.number().min(0);

export const uuidParam = (key: string = "id") =>
    z.object({
        params: z.object({
            [key]: uuid
        })
    });

export const stringParam = (key: string, max: number = 255) =>
    z.object({
        params: z.object({
            [key]: z.string().min(1).max(max)
        })
    });

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
