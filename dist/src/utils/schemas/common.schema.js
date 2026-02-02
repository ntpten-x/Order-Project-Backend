"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationQuerySchema = exports.stringParam = exports.uuidParam = exports.money = exports.uuid = void 0;
const zod_1 = require("zod");
exports.uuid = zod_1.z.string().uuid();
exports.money = zod_1.z.coerce.number().min(0);
const uuidParam = (key = "id") => zod_1.z.object({
    params: zod_1.z.object({
        [key]: exports.uuid
    })
});
exports.uuidParam = uuidParam;
const stringParam = (key, max = 255) => zod_1.z.object({
    params: zod_1.z.object({
        [key]: zod_1.z.string().min(1).max(max)
    })
});
exports.stringParam = stringParam;
exports.paginationQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.coerce.number().int().min(1).optional(),
        limit: zod_1.z.coerce.number().int().min(1).max(200).optional(),
        q: zod_1.z.string().optional(),
        status: zod_1.z.string().optional(),
        type: zod_1.z.string().optional(),
        category_id: exports.uuid.optional()
    }).passthrough()
});
