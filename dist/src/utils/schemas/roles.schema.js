"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRoleSchema = exports.createRoleSchema = exports.roleIdParamSchema = void 0;
const zod_1 = require("zod");
const roleBody = {
    roles_name: zod_1.z.string().min(3).max(50),
    display_name: zod_1.z.string().min(3).max(50)
};
exports.roleIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().uuid()
    })
});
exports.createRoleSchema = zod_1.z.object({
    body: zod_1.z.object(roleBody)
});
exports.updateRoleSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().uuid()
    }),
    body: zod_1.z.object(roleBody)
        .partial()
        .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" })
});
