import { z } from "zod";
import { PaymentStatus } from "../../entity/pos/Payments";

const uuid = z.string().uuid();

export const createPaymentSchema = z.object({
    body: z.object({
        order_id: uuid,
        payment_method_id: uuid,
        amount: z.coerce.number().positive(),
        amount_received: z.coerce.number().min(0).optional(),
        status: z.nativeEnum(PaymentStatus).optional()
    }).passthrough()
});

export const updatePaymentSchema = z.object({
    params: z.object({
        id: uuid
    }),
    body: z.object({
        amount: z.coerce.number().positive().optional(),
        amount_received: z.coerce.number().min(0).optional(),
        status: z.nativeEnum(PaymentStatus).optional()
    }).passthrough()
});

export const paymentIdParamSchema = z.object({
    params: z.object({
        id: uuid
    })
});
