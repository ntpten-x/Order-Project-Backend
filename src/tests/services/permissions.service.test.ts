import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionsService } from "../../services/permissions.service";

const {
    countPrivilegeEventMock,
    invalidatePermissionDecisionCacheByUserMock,
    invalidateAllPermissionDecisionCacheMock,
    runInTransactionMock,
} = vi.hoisted(() => ({
    countPrivilegeEventMock: vi.fn(),
    invalidatePermissionDecisionCacheByUserMock: vi.fn(),
    invalidateAllPermissionDecisionCacheMock: vi.fn(),
    runInTransactionMock: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

vi.mock("../../utils/metrics", () => ({
    metrics: {
        countPrivilegeEvent: countPrivilegeEventMock,
    },
}));

vi.mock("../../utils/permissionCache", () => ({
    invalidatePermissionDecisionCacheByUser: invalidatePermissionDecisionCacheByUserMock,
    invalidateAllPermissionDecisionCache: invalidateAllPermissionDecisionCacheMock,
    resolvePermissionDecisionWithCache: vi.fn(),
}));

vi.mock("../../database/dbContext", () => ({
    runInTransaction: runInTransactionMock,
}));

describe("permissions service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("invalidates permission decision cache after override update", async () => {
        const permissionsModel = {
            replaceUserOverrides: vi.fn().mockResolvedValue(undefined),
            createPermissionAudit: vi.fn().mockResolvedValue(undefined),
        };
        const usersModel = {
            findOne: vi.fn().mockResolvedValue({
                id: "u1",
                username: "alice",
                name: "Alice",
                roles_id: "r1",
            }),
        };

        const service = new PermissionsService(permissionsModel as any, {} as any, usersModel as any);
        vi.spyOn(service, "getEffectiveByUserId").mockResolvedValue({
            user: {
                id: "u1",
                username: "alice",
                name: "Alice",
                roleId: "r1",
            },
            role: {
                id: "r1",
                roles_name: "Manager",
                display_name: "Manager",
            },
            permissions: [],
        });

        await service.replaceUserOverrides("u1", [], "admin-1", "test");

        expect(permissionsModel.replaceUserOverrides).toHaveBeenCalledWith("u1", []);
        expect(invalidatePermissionDecisionCacheByUserMock).toHaveBeenCalledWith("u1");
        expect(permissionsModel.createPermissionAudit).toHaveBeenCalledWith(
            expect.objectContaining({
                targetType: "user",
                targetId: "u1",
                actionType: "update_overrides",
            })
        );
        expect(countPrivilegeEventMock).toHaveBeenCalledWith({
            event: "override_update",
            result: "success",
        });
    });

    it("creates approval request for high-risk override changes", async () => {
        const permissionsModel = {
            createOverrideApprovalRequest: vi.fn().mockResolvedValue({
                id: "approval-1",
                status: "pending",
                target_user_id: "u1",
                requested_by_user_id: "admin-1",
                created_at: "2026-02-12T00:00:00.000Z",
            }),
            createPermissionAudit: vi.fn().mockResolvedValue(undefined),
            replaceUserOverrides: vi.fn().mockResolvedValue(undefined),
        };
        const usersModel = {
            findOne: vi.fn().mockResolvedValue({ id: "u1", roles_id: "r1" }),
        };

        const service = new PermissionsService(permissionsModel as any, {} as any, usersModel as any);
        const result = await service.submitUserOverrideUpdate({
            targetUserId: "u1",
            actorUserId: "admin-1",
            actorRoleName: "Admin",
            permissions: [
                {
                    resourceKey: "orders.page",
                    canAccess: true,
                    canView: true,
                    canCreate: true,
                    canUpdate: true,
                    canDelete: true,
                    dataScope: "all",
                },
            ],
            reason: "need elevated access",
        });

        expect(result).toEqual(
            expect.objectContaining({
                updated: false,
                approvalRequired: true,
            })
        );
        expect(permissionsModel.createOverrideApprovalRequest).toHaveBeenCalledOnce();
        expect(permissionsModel.replaceUserOverrides).not.toHaveBeenCalled();
    });

    it("replaces role permissions and writes audit", async () => {
        const permissionsModel = {
            replaceRolePermissions: vi.fn().mockResolvedValue(undefined),
            createPermissionAudit: vi.fn().mockResolvedValue(undefined),
        };
        const rolesModel = {
            findOne: vi.fn().mockResolvedValue({
                id: "r1",
                roles_name: "Manager",
                display_name: "Manager",
            }),
        };

        const service = new PermissionsService(permissionsModel as any, rolesModel as any, {} as any);
        vi.spyOn(service, "getEffectiveByRoleId")
            .mockResolvedValueOnce({
                role: { id: "r1", roles_name: "Manager", display_name: "Manager" },
                permissions: [],
            })
            .mockResolvedValueOnce({
                role: { id: "r1", roles_name: "Manager", display_name: "Manager" },
                permissions: [],
            });

        await service.replaceRolePermissions("r1", [], "admin-1", "role-update");

        expect(permissionsModel.replaceRolePermissions).toHaveBeenCalledWith("r1", []);
        expect(invalidateAllPermissionDecisionCacheMock).toHaveBeenCalledOnce();
        expect(permissionsModel.createPermissionAudit).toHaveBeenCalledWith(
            expect.objectContaining({
                targetType: "role",
                targetId: "r1",
                actionType: "update_role_permissions",
            })
        );
    });

    it("applies low-risk override changes immediately", async () => {
        const permissionsModel = {
            replaceUserOverrides: vi.fn().mockResolvedValue(undefined),
            createPermissionAudit: vi.fn().mockResolvedValue(undefined),
            createOverrideApprovalRequest: vi.fn(),
        };
        const usersModel = {
            findOne: vi.fn().mockResolvedValue({
                id: "u1",
                username: "alice",
                roles_id: "r1",
            }),
        };

        const service = new PermissionsService(permissionsModel as any, {} as any, usersModel as any);
        vi.spyOn(service, "getEffectiveByUserId").mockResolvedValue({
            user: { id: "u1", username: "alice", roleId: "r1" },
            role: { id: "r1", roles_name: "Employee", display_name: "Employee" },
            permissions: [],
        });

        const result = await service.submitUserOverrideUpdate({
            targetUserId: "u1",
            actorUserId: "admin-1",
            actorRoleName: "Admin",
            permissions: [
                {
                    resourceKey: "orders.page",
                    canAccess: true,
                    canView: true,
                    canCreate: false,
                    canUpdate: false,
                    canDelete: false,
                    dataScope: "branch",
                },
            ],
            reason: "normal update",
        });

        expect(result).toEqual({ updated: true, approvalRequired: false });
        expect(permissionsModel.replaceUserOverrides).toHaveBeenCalledOnce();
        expect(permissionsModel.createOverrideApprovalRequest).not.toHaveBeenCalled();
    });

    it("prevents requester from approving own request", async () => {
        const permissionsModel = {
            findOverrideApprovalById: vi.fn().mockResolvedValue({
                id: "approval-1",
                target_user_id: "u1",
                requested_by_user_id: "admin-1",
                status: "pending",
                permissions_payload: [],
                risk_flags: ["delete"],
            }),
        };

        const service = new PermissionsService(permissionsModel as any, {} as any, {} as any);

        await expect(
            service.reviewOverrideApproval({
                approvalId: "approval-1",
                decision: "approved",
                approverUserId: "admin-1",
                approverRoleName: "Admin",
                reviewReason: "self approve",
            })
        ).rejects.toThrow("Two-person approval required");
    });
});
