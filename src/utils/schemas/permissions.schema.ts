import { z } from "zod";

export const permissionRoleIdParamSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const permissionUserIdParamSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

const scopeEnum = z.enum(["none", "own", "branch", "all"]);

export const updateUserPermissionsSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        permissions: z.array(
            z.object({
                resourceKey: z.string().min(1).max(120),
                canAccess: z.boolean(),
                canView: z.boolean(),
                canCreate: z.boolean(),
                canUpdate: z.boolean(),
                canDelete: z.boolean(),
                dataScope: scopeEnum,
            })
        ),
        reason: z.string().min(3).max(500).optional(),
    }),
});

export const updateRolePermissionsSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        permissions: z.array(
            z.object({
                resourceKey: z.string().min(1).max(120),
                canAccess: z.boolean(),
                canView: z.boolean(),
                canCreate: z.boolean(),
                canUpdate: z.boolean(),
                canDelete: z.boolean(),
                dataScope: scopeEnum,
            })
        ),
        reason: z.string().min(3).max(500).optional(),
    }),
});

export const simulatePermissionSchema = z.object({
    body: z.object({
        userId: z.string().uuid(),
        resourceKey: z.string().min(1).max(120),
        actionKey: z.enum(["access", "view", "create", "update", "delete"]),
    }),
});

export const permissionAuditsQuerySchema = z.object({
    query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        targetType: z.enum(["role", "user"]).optional(),
        targetId: z.string().uuid().optional(),
        actionType: z.string().min(1).max(30).optional(),
        actorUserId: z.string().uuid().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
    }),
});

export const permissionApprovalsQuerySchema = z.object({
    query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        targetUserId: z.string().uuid().optional(),
        requestedByUserId: z.string().uuid().optional(),
    }),
});

export const reviewApprovalSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        reviewReason: z.string().min(3).max(500).optional(),
    }).optional(),
});

export const reviewRejectApprovalSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        reviewReason: z.string().min(3).max(500),
    }),
});
