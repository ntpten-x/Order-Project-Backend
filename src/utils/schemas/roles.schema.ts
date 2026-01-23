import { z } from "zod";

const roleBody = {
    roles_name: z.string().min(3).max(50),
    display_name: z.string().min(3).max(50)
};

export const roleIdParamSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    })
});

export const createRoleSchema = z.object({
    body: z.object(roleBody)
});

export const updateRoleSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    }),
    body: z.object(roleBody)
        .partial()
        .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" })
});
