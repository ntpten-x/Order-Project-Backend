import { z } from "zod";

const tableToken = z
    .string()
    .min(16)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid table token format");

const orderItemSchema = z
    .object({
        product_id: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(50),
        notes: z.string().trim().max(500).optional(),
    })
    .strict();

export const publicTableTokenParamSchema = z.object({
    params: z.object({
        token: tableToken,
    }),
});

export const publicSubmitOrderSchema = z.object({
    params: z.object({
        token: tableToken,
    }),
    body: z
        .object({
            items: z.array(orderItemSchema).min(1).max(100),
            customer_note: z.string().trim().max(1000).optional(),
        })
        .strict(),
});

export const publicOrderByIdParamSchema = z.object({
    params: z.object({
        token: tableToken,
        orderId: z.string().uuid(),
    }),
});
