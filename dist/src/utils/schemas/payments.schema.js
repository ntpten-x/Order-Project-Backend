"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentIdParamSchema = exports.updatePaymentSchema = exports.createPaymentSchema = void 0;
const zod_1 = require("zod");
const Payments_1 = require("../../entity/pos/Payments");
const uuid = zod_1.z.string().uuid();
exports.createPaymentSchema = zod_1.z.object({
    body: zod_1.z.object({
        order_id: uuid,
        payment_method_id: uuid,
        amount: zod_1.z.coerce.number().positive(),
        amount_received: zod_1.z.coerce.number().min(0).optional(),
        status: zod_1.z.nativeEnum(Payments_1.PaymentStatus).optional()
    }).passthrough()
});
exports.updatePaymentSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: uuid
    }),
    body: zod_1.z.object({
        amount: zod_1.z.coerce.number().positive().optional(),
        amount_received: zod_1.z.coerce.number().min(0).optional(),
        status: zod_1.z.nativeEnum(Payments_1.PaymentStatus).optional()
    }).passthrough()
});
exports.paymentIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: uuid
    })
});
