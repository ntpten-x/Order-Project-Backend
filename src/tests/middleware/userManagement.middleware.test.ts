import { beforeEach, describe, expect, it, vi } from "vitest";
import { enforceUserManagementPolicy } from "../../middleware/userManagement.middleware";

const {
    getDbContextMock,
    getRepositoryMock,
    roleFindOneMock,
    userFindOneMock,
} = vi.hoisted(() => ({
    getDbContextMock: vi.fn(),
    getRepositoryMock: vi.fn(),
    roleFindOneMock: vi.fn(),
    userFindOneMock: vi.fn(),
}));

vi.mock("../../database/dbContext", () => ({
    getDbContext: getDbContextMock,
    getRepository: getRepositoryMock,
}));

vi.mock("../../entity/Roles", () => ({
    Roles: class Roles {},
}));

vi.mock("../../entity/Users", () => ({
    Users: class Users {},
}));

function createResponseMock() {
    return {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    } as any;
}

describe("enforceUserManagementPolicy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRepositoryMock.mockImplementation((entity: { name?: string }) => {
            if (entity?.name === "Roles") {
                return { findOne: roleFindOneMock };
            }

            return { findOne: userFindOneMock };
        });
    });

    it("hides cross-branch users from manager updates", async () => {
        getDbContextMock.mockReturnValue({
            branchId: "branch-actor",
            isAdmin: false,
        });
        userFindOneMock.mockResolvedValue({
            id: "target-user",
            branch_id: "branch-other",
            roles: { roles_name: "Employee" },
        });

        const req = {
            method: "PUT",
            params: { id: "target-user" },
            body: {},
            user: {
                id: "manager-1",
                roles: { roles_name: "Manager" },
            },
        } as any;
        const res = createResponseMock();
        const next = vi.fn();

        await enforceUserManagementPolicy(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: {
                code: "NOT_FOUND",
                message: "User not found",
            },
        });
    });
});
