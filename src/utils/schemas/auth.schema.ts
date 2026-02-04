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
