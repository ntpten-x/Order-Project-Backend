import { z } from "zod";
import { AuditActionType } from "../auditTypes";
import { uuid } from "./common.schema";

// Filters for audit log listing
export const auditQuerySchema = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).max(1000).optional(),
            limit: z.coerce.number().int().min(1).max(100).optional(),
            action_type: z.nativeEnum(AuditActionType).optional(),
            entity_type: z.string().max(100).optional(),
            entity_id: uuid.optional(),
            user_id: uuid.optional(),
            branch_id: uuid.optional(),
            start_date: z.coerce.date().optional(),
            end_date: z.coerce.date().optional(),
            search: z.string().max(200).optional(),
        })
        .passthrough(),
});

export const auditIdParamSchema = z.object({
    params: z.object({
        id: uuid,
    }),
});
