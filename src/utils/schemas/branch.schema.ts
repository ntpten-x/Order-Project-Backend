import { z } from "zod";
import { uuid } from "./common.schema";

const optionalNullableText = z.string().nullable().optional();
const optionalNullablePhone = z.string().max(20).nullable().optional();
const optionalNullableTaxId = z.string().max(50).nullable().optional();

export const branchIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const createBranchSchema = z.object({
    body: z.object({
        branch_name: z.string().trim().min(1).max(100),
        branch_code: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9]+$/),
        address: optionalNullableText,
        phone: optionalNullablePhone,
        tax_id: optionalNullableTaxId,
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

export const updateBranchSchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        branch_name: z.string().trim().min(1).max(100).optional(),
        branch_code: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9]+$/).optional(),
        address: optionalNullableText,
        phone: optionalNullablePhone,
        tax_id: optionalNullableTaxId,
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});
