"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = exports.createUserSchema = void 0;
const zod_1 = require("zod");
exports.createUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        username: zod_1.z.string()
            .min(3, "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร")
            .max(20, "ชื่อผู้ใช้ต้องไม่เกิน 20 ตัวอักษร")
            .regex(/^[a-zA-Z0-9_]+$/, "ชื่อผู้ใช้ต้องประกอบด้วยตัวอักษรภาษาอังกฤษ ตัวเลข หรือขีดล่าง (_) เท่านั้น"),
        password: zod_1.z.string()
            .min(6, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"),
        firstName: zod_1.z.string().optional(),
        lastName: zod_1.z.string().optional(),
        roles_id: zod_1.z.string().uuid("รูปแบบรหัสบทบาทไม่ถูกต้อง"),
        branch_id: zod_1.z.string().uuid(),
        is_active: zod_1.z.boolean().optional(),
        is_use: zod_1.z.boolean().optional()
    })
});
exports.updateUserSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().uuid("รูปแบบรหัสผู้ใช้ไม่ถูกต้อง")
    }),
    body: zod_1.z.object({
        username: zod_1.z.string().min(3).max(20).optional(),
        password: zod_1.z.string().min(6).optional(),
        firstName: zod_1.z.string().optional(),
        lastName: zod_1.z.string().optional(),
        roles_id: zod_1.z.string().uuid().optional(),
        branch_id: zod_1.z.string().uuid().optional(),
        is_use: zod_1.z.boolean().optional(),
        is_active: zod_1.z.boolean().optional()
    })
});
