import { z } from "zod";
import { uuid } from "./common.schema";

export const branchIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const createBranchSchema = z.object({
    body: z.object({
        branch_name: z.string().min(1).max(100),
        branch_code: z.string().min(1).max(20),
        address: z.string().optional(),
        phone: z.string().max(20).optional(),
        tax_id: z.string().max(50).optional(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

export const updateBranchSchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        branch_name: z.string().min(1).max(100).optional(),
        branch_code: z.string().min(1).max(20).optional(),
        address: z.string().optional(),
        phone: z.string().max(20).optional(),
        tax_id: z.string().max(50).optional(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});
