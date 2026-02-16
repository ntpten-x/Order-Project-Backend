import { z } from "zod";

const displayNameSchema = z.string().trim().min(1, "Display name is required").max(100, "Display name is too long");

const nameCompatibilityFields = {
    name: displayNameSchema.optional(),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
};

const createUserBodySchema = z
    .object({
        username: z
            .string()
            .min(3, "Username must be at least 3 characters")
            .max(20, "Username must be 20 characters or fewer")
            .regex(/^[a-zA-Z0-9_]+$/, "Username may contain only letters, numbers, and underscore"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        ...nameCompatibilityFields,
        roles_id: z.string().uuid("Invalid role id format"),
        branch_id: z.string().uuid("Invalid branch id format"),
        is_active: z.boolean().optional(),
        is_use: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
        const hasName = Boolean(data.name?.trim());
        const hasLegacyName = Boolean(data.firstName?.trim() || data.lastName?.trim());
        if (!hasName && !hasLegacyName) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["name"],
                message: "Either name or firstName/lastName is required",
            });
        }
    });

const updateUserBodySchema = z.object({
    username: z.string().min(3).max(20).optional(),
    password: z.string().min(6).optional(),
    ...nameCompatibilityFields,
    roles_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    is_use: z.boolean().optional(),
    is_active: z.boolean().optional(),
});

export const createUserSchema = z.object({
    body: createUserBodySchema,
});

export const updateUserSchema = z.object({
    params: z.object({
        id: z.string().uuid("Invalid user id format"),
    }),
    body: updateUserBodySchema,
});
