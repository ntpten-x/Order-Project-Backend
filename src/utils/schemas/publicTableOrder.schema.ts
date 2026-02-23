import { z } from "zod";

const tableToken = z
    .string()
    .min(16)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid table token format");

const orderItemDetailSchema = z
    .object({
        detail_name: z.string().min(1).max(120),
        extra_price: z.coerce.number().min(0).max(999999).optional(),
    })
    .passthrough();

const orderItemSchema = z
    .object({
        product_id: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(50),
        notes: z.string().max(500).optional(),
        details: z.array(orderItemDetailSchema).max(20).optional(),
    })
    .passthrough();

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
            customer_note: z.string().max(1000).optional(),
        })
        .passthrough(),
});

export const publicOrderByIdParamSchema = z.object({
    params: z.object({
        token: tableToken,
        orderId: z.string().uuid(),
    }),
});
