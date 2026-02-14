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
                })
                .mockResolvedValueOnce({
                    id: "u1",
                    username: "alice",
                    is_use: false,
                }),
            findOneByUsername: vi.fn(),
            update: vi.fn().mockResolvedValue(undefined),
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
        expect(emitToRoleMock).toHaveBeenCalledWith("Admin", expect.any(String), result);
    });
});
