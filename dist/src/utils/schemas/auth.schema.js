"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.switchBranchSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
const common_schema_1 = require("./common.schema");
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        username: zod_1.z.string()
            .min(1, "Username cannot be empty"),
        password: zod_1.z.string()
            .min(1, "Password cannot be empty")
    })
});
exports.switchBranchSchema = zod_1.z.object({
    body: zod_1.z.object({
        branch_id: common_schema_1.uuid.nullable().optional(),
    }).passthrough(),
});
