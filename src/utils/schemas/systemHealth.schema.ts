import { z } from "zod";

export const systemHealthQuerySchema = z.object({
    query: z.object({
        method: z.enum(["ALL", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).optional(),
        minSamples: z.coerce.number().int().min(1).max(100).optional(),
    }).passthrough(),
});
