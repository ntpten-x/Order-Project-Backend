import { z } from "zod";

export const paymentAccountSchema = z.object({
    account_name: z.string().min(1, "Account name is required"),
    account_number: z.string()
        .min(10, "Number must be at least 10 characters")
        .regex(/^\d+$/, "Number must contain only numbers"),
    bank_name: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    account_type: z.enum(["PromptPay", "BankAccount"]).optional().default("PromptPay"),
    is_active: z.boolean().optional().default(false)
});

export type CreatePaymentAccountDto = z.infer<typeof paymentAccountSchema>;
