import { z } from "zod";
import { uuid } from "./common.schema";

export const loginSchema = z.object({
    body: z.object({
        username: z.string()
            .min(1, "Username cannot be empty"),
        password: z.string()
            .min(1, "Password cannot be empty")
    })
});

export const switchBranchSchema = z.object({
    body: z.object({
        branch_id: uuid.nullable().optional(),
    }).passthrough(),
});

export const updateMeSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Name cannot be empty").max(100).optional(),
        password: z.string().min(6, "Password must be at least 6 characters").max(100).optional(),
    }).refine((data) => data.name !== undefined || data.password !== undefined, {
        message: "At least one field is required",
    }),
});
