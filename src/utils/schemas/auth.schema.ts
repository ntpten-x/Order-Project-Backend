import { z } from "zod";

export const loginSchema = z.object({
    body: z.object({
        username: z.string()
            .min(1, "Username cannot be empty"),
        password: z.string()
            .min(1, "Password cannot be empty")
    })
});
