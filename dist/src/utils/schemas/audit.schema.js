"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditIdParamSchema = exports.auditQuerySchema = void 0;
const zod_1 = require("zod");
const auditTypes_1 = require("../auditTypes");
const common_schema_1 = require("./common.schema");
// Filters for audit log listing
exports.auditQuerySchema = zod_1.z.object({
    query: zod_1.z
        .object({
        page: zod_1.z.coerce.number().int().min(1).max(1000).optional(),
        limit: zod_1.z.coerce.number().int().min(1).max(100).optional(),
        action_type: zod_1.z.nativeEnum(auditTypes_1.AuditActionType).optional(),
        entity_type: zod_1.z.string().max(100).optional(),
        entity_id: common_schema_1.uuid.optional(),
        user_id: common_schema_1.uuid.optional(),
        branch_id: common_schema_1.uuid.optional(),
        start_date: zod_1.z.coerce.date().optional(),
        end_date: zod_1.z.coerce.date().optional(),
        search: zod_1.z.string().max(200).optional(),
    })
        .passthrough(),
});
exports.auditIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: common_schema_1.uuid,
    }),
});
