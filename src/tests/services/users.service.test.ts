import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersService } from "../../services/users.service";

const { emitToRoleMock, countPrivilegeEventMock, invalidatePermissionDecisionCacheByUserMock } = vi.hoisted(() => ({
    emitToRoleMock: vi.fn(),
    countPrivilegeEventMock: vi.fn(),
    invalidatePermissionDecisionCacheByUserMock: vi.fn(),
}));

vi.mock("../../services/socket.service", () => ({
    SocketService: {
        getInstance: () => ({
            emitToRole: emitToRoleMock,
        }),
    },
}));

vi.mock("../../utils/metrics", () => ({
    metrics: {
        countPrivilegeEvent: countPrivilegeEventMock,
    },
}));

vi.mock("../../utils/permissionCache", () => ({
    invalidatePermissionDecisionCacheByUser: invalidatePermissionDecisionCacheByUserMock,
}));

describe("users service offboarding", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("revokes user overrides when user is disabled", async () => {
        const usersModel = {
            findOne: vi
                .fn()
                .mockResolvedValueOnce({
                    id: "u1",
                    username: "alice",
                    is_use: true,
                    password: "hashed-password",
                })
                .mockResolvedValueOnce({
                    id: "u1",
                    username: "alice",
                    is_use: false,
                    password: "hashed-password-next",
                }),
            findOneByUsername: vi.fn(),
            update: vi.fn().mockResolvedValue({
                id: "u1",
                username: "alice",
                is_use: false,
                password: "hashed-password-next",
            }),
            revokeUserPermissionOverrides: vi.fn().mockResolvedValue(3),
        };

        const service = new UsersService(usersModel as any);
        const result = await service.update("u1", { is_use: false } as any, "admin-1");

        expect(usersModel.revokeUserPermissionOverrides).toHaveBeenCalledWith("u1", "admin-1");
        expect(usersModel.update).toHaveBeenCalledWith("u1", expect.objectContaining({ is_use: false }));
        expect(countPrivilegeEventMock).toHaveBeenCalledWith({
            event: "override_revoke_offboarding",
            result: "success",
        });
        expect(invalidatePermissionDecisionCacheByUserMock).toHaveBeenCalledWith("u1");
        expect(emitToRoleMock).toHaveBeenCalledWith(
            "Admin",
            expect.any(String),
            expect.not.objectContaining({ password: expect.anything() })
        );
        expect(result).toEqual(
            expect.objectContaining({
                id: "u1",
                username: "alice",
                is_use: false,
            })
        );
    });

    it("returns the updated user even when branch-scoped lookup by id would hide the record", async () => {
        const usersModel = {
            findOne: vi.fn().mockResolvedValue({
                id: "u2",
                username: "bob",
                roles_id: "role-employee",
                is_use: true,
            }),
            findOneByUsername: vi.fn().mockResolvedValue({
                id: "u2",
                username: "bob",
                branch_id: "branch-2",
                password: "hashed-password",
            }),
            update: vi.fn().mockResolvedValue({
                id: "u2",
                username: "bob",
                branch_id: "branch-2",
                password: "hashed-password",
            }),
            revokeUserPermissionOverrides: vi.fn(),
        };

        const service = new UsersService(usersModel as any);
        const result = await service.update("u2", { branch_id: "branch-2" } as any, "admin-1");

        expect(usersModel.update).toHaveBeenCalledWith("u2", expect.objectContaining({ branch_id: "branch-2" }));
        expect(usersModel.findOneByUsername).toHaveBeenCalledWith("bob");
        expect(result).toEqual(
            expect.objectContaining({
                id: "u2",
                branch_id: "branch-2",
            })
        );
        expect(emitToRoleMock).toHaveBeenCalledWith(
            "Admin",
            expect.any(String),
            expect.not.objectContaining({ password: expect.anything() })
        );
    });
});
