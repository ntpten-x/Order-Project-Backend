"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentAccountSchema = void 0;
const zod_1 = require("zod");
exports.paymentAccountSchema = zod_1.z.object({
    account_name: zod_1.z.string().min(1, "Account name is required"),
    account_number: zod_1.z.string()
        .min(10, "Number must be at least 10 characters")
        .regex(/^\d+$/, "Number must contain only numbers"),
    bank_name: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    account_type: zod_1.z.enum(["PromptPay", "BankAccount"]).optional().default("PromptPay"),
    is_active: zod_1.z.boolean().optional().default(false)
});
