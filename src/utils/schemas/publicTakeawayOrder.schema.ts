import { z } from "zod";

const takeawayToken = z
    .string()
    .min(16)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid takeaway token format");

const orderItemSchema = z
    .object({
        product_id: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(50),
        notes: z.string().trim().max(500).optional(),
    })
    .strict();

export const publicTakeawayTokenParamSchema = z.object({
    params: z.object({
        token: takeawayToken,
    }),
});

export const publicTakeawaySubmitOrderSchema = z
    .object({
        params: z.object({
            token: takeawayToken,
        }),
        body: z
            .object({
                items: z.array(orderItemSchema).min(1).max(100),
                customer_name: z.string().trim().max(120).optional(),
                customer_phone: z.string().trim().max(20).optional(),
            })
            .strict(),
    })
    .superRefine((value, ctx) => {
        if (!value.body.customer_name?.trim() && !value.body.customer_phone?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["body", "customer_name"],
                message: "Customer name or phone is required",
            });
        }
    });

export const publicTakeawayOrderByIdParamSchema = z.object({
    params: z.object({
        token: takeawayToken,
        orderId: z.string().uuid(),
    }),
});
