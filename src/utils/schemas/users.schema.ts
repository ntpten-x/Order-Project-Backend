import { z } from "zod";

export const createUserSchema = z.object({
    body: z.object({
        username: z.string()
            .min(3, "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร")
            .max(20, "ชื่อผู้ใช้ต้องไม่เกิน 20 ตัวอักษร")
            .regex(/^[a-zA-Z0-9_]+$/, "ชื่อผู้ใช้ต้องประกอบด้วยตัวอักษรภาษาอังกฤษ ตัวเลข หรือขีดล่าง (_) เท่านั้น"),
        password: z.string()
            .min(6, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        roles_id: z.string().uuid("รูปแบบรหัสบทบาทไม่ถูกต้อง"),
        branch_id: z.string().uuid(),
        is_active: z.boolean().optional(),
        is_use: z.boolean().optional()
    })
});

export const updateUserSchema = z.object({
    params: z.object({
        id: z.string().uuid("รูปแบบรหัสผู้ใช้ไม่ถูกต้อง")
    }),
    body: z.object({
        username: z.string().min(3).max(20).optional(),
        password: z.string().min(6).optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        roles_id: z.string().uuid().optional(),
        branch_id: z.string().uuid().optional(),
        is_use: z.boolean().optional(),
        is_active: z.boolean().optional()
    })
});
