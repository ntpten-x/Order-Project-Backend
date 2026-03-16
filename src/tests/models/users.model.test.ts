import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersModels } from "../../models/users.model";

const { getDbContextMock, getRepositoryMock, saveMock, deleteMock } = vi.hoisted(() => ({
    getDbContextMock: vi.fn(),
    getRepositoryMock: vi.fn(),
    saveMock: vi.fn(),
    deleteMock: vi.fn(),
}));

vi.mock("../../database/dbContext", () => ({
    getDbContext: getDbContextMock,
    getRepository: getRepositoryMock,
    getDbManager: vi.fn(),
}));

describe("users model branch assignment", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRepositoryMock.mockReturnValue({
            save: saveMock,
            delete: deleteMock,
        });
    });

    it("allows admin updates to keep an explicitly selected branch", async () => {
        getDbContextMock.mockReturnValue({
            branchId: "branch-admin-active",
            isAdmin: true,
        });
        saveMock.mockResolvedValue({
            id: "user-1",
            branch_id: "branch-target",
        });

        const model = new UsersModels();
        await model.update(
            "user-1",
            {
                username: "employee-1",
                branch_id: "branch-target",
            } as any
        );

        expect(saveMock).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "user-1",
                branch_id: "branch-target",
            })
        );
    });

    it("forces branch scoped updates back to the actor branch", async () => {
        getDbContextMock.mockReturnValue({
            branchId: "branch-actor",
            isAdmin: false,
        });
        saveMock.mockResolvedValue({
            id: "user-1",
            branch_id: "branch-actor",
        });

        const model = new UsersModels();
        vi.spyOn(model, "findOne").mockResolvedValue({
            id: "user-1",
            branch_id: "branch-actor",
        } as any);

        await model.update(
            "user-1",
            {
                username: "employee-1",
                branch_id: "branch-target",
            } as any
        );

        expect(saveMock).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "user-1",
                branch_id: "branch-actor",
            })
        );
    });

    it("allows admin deletes outside the currently selected branch", async () => {
        getDbContextMock.mockReturnValue({
            branchId: "branch-admin-active",
            isAdmin: true,
        });
        deleteMock.mockResolvedValue({ affected: 1 });

        const model = new UsersModels();
        await model.delete("user-2");

        expect(deleteMock).toHaveBeenCalledWith("user-2");
    });
});
