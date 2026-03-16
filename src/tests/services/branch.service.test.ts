import { beforeEach, describe, expect, it, vi } from "vitest";
import { Branch } from "../../entity/Branch";
import { Users } from "../../entity/Users";
import { BranchService } from "../../services/branch.service";

const { getRepositoryMock, emitToRoleMock } = vi.hoisted(() => ({
    getRepositoryMock: vi.fn(),
    emitToRoleMock: vi.fn(),
}));

vi.mock("../../database/dbContext", () => ({
    getRepository: getRepositoryMock,
}));

vi.mock("../../services/socket.service", () => ({
    SocketService: {
        getInstance: () => ({
            emitToRole: emitToRoleMock,
        }),
    },
}));

describe("branch service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("normalizes branch code on create and emits realtime update", async () => {
        const getOneMock = vi.fn().mockResolvedValue(null);
        const saveMock = vi.fn().mockImplementation(async (payload) => ({
            id: "branch-1",
            ...payload,
        }));
        const branchRepo = {
            createQueryBuilder: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnThis(),
                getOne: getOneMock,
            }),
            create: vi.fn().mockImplementation((payload) => payload),
            save: saveMock,
        };

        getRepositoryMock.mockImplementation((entity) => {
            if (entity === Branch) return branchRepo;
            if (entity === Users) return {};
            return {};
        });

        const service = new BranchService();
        const created = await service.create({
            branch_name: "  Main Branch  ",
            branch_code: " mb01 ",
            address: " 123 main road ",
            phone: " 0123456789 ",
            tax_id: " TAX-1 ",
            is_active: true,
        });

        expect(getOneMock).toHaveBeenCalled();
        expect(saveMock).toHaveBeenCalledWith(
            expect.objectContaining({
                branch_name: "Main Branch",
                branch_code: "MB01",
                address: "123 main road",
                phone: "0123456789",
                tax_id: "TAX-1",
                is_active: true,
            })
        );
        expect(emitToRoleMock).toHaveBeenCalledWith("Admin", "branches:create", created);
    });

    it("blocks deactivating the last active branch", async () => {
        const branchRepo = {
            findOneBy: vi.fn().mockResolvedValue({
                id: "branch-1",
                branch_name: "Main Branch",
                branch_code: "MB01",
                is_active: true,
            }),
            countBy: vi.fn().mockResolvedValue(1),
        };

        getRepositoryMock.mockImplementation((entity) => {
            if (entity === Branch) return branchRepo;
            if (entity === Users) return { countBy: vi.fn() };
            return {};
        });

        const service = new BranchService();

        await expect(
            service.update("branch-1", {
                is_active: false,
            })
        ).rejects.toThrow("last active branch");
    });

    it("blocks deleting a branch that still has assigned users", async () => {
        const saveMock = vi.fn();
        const branchRepo = {
            findOneBy: vi.fn().mockResolvedValue({
                id: "branch-1",
                branch_name: "Main Branch",
                branch_code: "MB01",
                is_active: true,
            }),
            countBy: vi.fn().mockResolvedValue(2),
            save: saveMock,
        };
        const usersRepo = {
            countBy: vi.fn().mockResolvedValue(3),
        };

        getRepositoryMock.mockImplementation((entity) => {
            if (entity === Branch) return branchRepo;
            if (entity === Users) return usersRepo;
            return {};
        });

        const service = new BranchService();

        await expect(service.delete("branch-1")).rejects.toThrow("assigned users");
        expect(saveMock).not.toHaveBeenCalled();
    });
});
