import { z } from "zod";

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username can contain only letters, numbers, and underscore (_)");

const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const nameSchema = z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters");

export const createUserSchema = z.object({
  body: z
    .object({
      username: usernameSchema,
      password: passwordSchema,

      // Preferred field.
      name: nameSchema.optional(),

      // Backward compatibility only.
      firstName: z.string().max(100).optional(),
      lastName: z.string().max(100).optional(),

      roles_id: z.string().uuid("roles_id must be a valid UUID"),
      branch_id: z.string().uuid("branch_id must be a valid UUID"),
      is_active: z.boolean().optional(),
      is_use: z.boolean().optional(),
    })
    .refine(
      (v) => {
        const hasName = typeof v.name === "string" && v.name.trim().length > 0;
        const hasFirstOrLast =
          (typeof v.firstName === "string" && v.firstName.trim().length > 0) ||
          (typeof v.lastName === "string" && v.lastName.trim().length > 0);
        return hasName || hasFirstOrLast;
      },
      { message: "Name is required", path: ["name"] }
    ),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid("id must be a valid UUID"),
  }),
  body: z.object({
    username: usernameSchema.optional(),
    password: passwordSchema.optional(),

    name: nameSchema.optional(),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),

    roles_id: z.string().uuid("roles_id must be a valid UUID").optional(),
    branch_id: z.string().uuid("branch_id must be a valid UUID").optional(),
    is_use: z.boolean().optional(),
    is_active: z.boolean().optional(),
  }),
});
