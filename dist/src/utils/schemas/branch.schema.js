"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBranchSchema = exports.createBranchSchema = exports.branchIdParamSchema = void 0;
const zod_1 = require("zod");
const common_schema_1 = require("./common.schema");
exports.branchIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.createBranchSchema = zod_1.z.object({
    body: zod_1.z.object({
        branch_name: zod_1.z.string().min(1).max(100),
        branch_code: zod_1.z.string().min(1).max(20),
        address: zod_1.z.string().optional(),
        phone: zod_1.z.string().max(20).optional(),
        tax_id: zod_1.z.string().max(50).optional(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
exports.updateBranchSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        branch_name: zod_1.z.string().min(1).max(100).optional(),
        branch_code: zod_1.z.string().min(1).max(20).optional(),
        address: zod_1.z.string().optional(),
        phone: zod_1.z.string().max(20).optional(),
        tax_id: zod_1.z.string().max(50).optional(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
