import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryService } from "../../services/pos/delivery.service";
import { TablesService } from "../../services/pos/tables.service";

const {
    emitToBranchMock,
    invalidateCacheMock,
    getDbContextMock,
    getRepositoryMock,
} = vi.hoisted(() => ({
    emitToBranchMock: vi.fn(),
    invalidateCacheMock: vi.fn(),
    getDbContextMock: vi.fn(),
    getRepositoryMock: vi.fn(),
}));

vi.mock("../../services/socket.service", () => ({
    SocketService: {
        getInstance: () => ({
            emitToBranch: emitToBranchMock,
        }),
    },
}));

vi.mock("../../database/dbContext", () => ({
    getDbContext: getDbContextMock,
    getRepository: getRepositoryMock,
}));

vi.mock("../../utils/cache", () => ({
    cacheKey: (...parts: Array<string | number | boolean | undefined>) =>
        parts.map((part) => (part === undefined ? "" : String(part))).join(":"),
    invalidateCache: invalidateCacheMock,
    queryCache: {},
    withCache: async <T,>(_: string, fetcher: () => Promise<T>) => fetcher(),
}));

describe("tables and delivery services", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDbContextMock.mockReturnValue({ branchId: "branch-1", isAdmin: false });
    });

    it("normalizes table names and avoids duplicate checks for casing-only updates", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "table-1",
                table_name: "Table A",
                branch_id: "branch-1",
            }),
            findOneByName: vi.fn(),
            update: vi.fn().mockResolvedValue({
                id: "table-1",
                table_name: "table a",
                branch_id: "branch-1",
            }),
        };

        const service = new TablesService(model as any);
        const result = await service.update("table-1", { table_name: "  table a  " } as any, "branch-1");

        expect(model.findOneByName).not.toHaveBeenCalled();
        expect(model.update).toHaveBeenCalledWith(
            "table-1",
            expect.objectContaining({ table_name: "table a" }),
            "branch-1"
        );
        expect(result).toEqual(
            expect.objectContaining({
                id: "table-1",
                table_name: "table a",
            })
        );
        expect(invalidateCacheMock).toHaveBeenCalledWith(
            expect.arrayContaining([
                "tables:branch:branch-1:list",
                "tables:branch:branch-1:name",
                "tables:branch:branch-1:single:table-1",
                "tables:admin:list",
                "tables:admin:name",
                "tables:admin:single:table-1",
                "tables:public:list",
                "tables:public:name",
                "tables:public:single:table-1",
            ])
        );
    });

    it("blocks table deletion when orders still reference the table", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "table-1",
                table_name: "Table A",
                branch_id: "branch-1",
            }),
            delete: vi.fn(),
        };
        getRepositoryMock.mockReturnValue({
            count: vi.fn().mockResolvedValue(2),
        });

        const service = new TablesService(model as any);

        await expect(service.delete("table-1", "branch-1")).rejects.toThrow(
            "Table cannot be deleted because it is referenced by orders"
        );
        expect(model.delete).not.toHaveBeenCalled();
    });

    it("normalizes delivery names and prefixes during create", async () => {
        const model = {
            findOneByName: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(async (input) => ({
                id: "delivery-1",
                branch_id: "branch-1",
                ...input,
            })),
        };

        const service = new DeliveryService(model as any);
        const result = await service.create({
            branch_id: "branch-1",
            delivery_name: "  Grab  ",
            delivery_prefix: "  ",
            is_active: true,
        } as any);

        expect(model.findOneByName).toHaveBeenCalledWith("Grab", "branch-1");
        expect(model.create).toHaveBeenCalledWith(
            expect.objectContaining({
                delivery_name: "Grab",
                delivery_prefix: null,
            })
        );
        expect(result).toEqual(
            expect.objectContaining({
                delivery_name: "Grab",
                delivery_prefix: null,
            })
        );
    });

    it("invalidates branch, admin, and public delivery caches after update", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "delivery-1",
                delivery_name: "Grab",
                branch_id: "branch-1",
            }),
            findOneByName: vi.fn(),
            update: vi.fn().mockResolvedValue({
                id: "delivery-1",
                delivery_name: "Grab",
                delivery_prefix: null,
                branch_id: "branch-1",
            }),
        };

        const service = new DeliveryService(model as any);
        await service.update(
            "delivery-1",
            {
                delivery_name: " grab ",
                delivery_prefix: " ",
            } as any,
            "branch-1"
        );

        expect(model.findOneByName).not.toHaveBeenCalled();
        expect(model.update).toHaveBeenCalledWith(
            "delivery-1",
            expect.objectContaining({
                delivery_name: "grab",
                delivery_prefix: null,
            }),
            "branch-1"
        );
        expect(invalidateCacheMock).toHaveBeenCalledWith(
            expect.arrayContaining([
                "delivery:branch:branch-1:list",
                "delivery:branch:branch-1:name",
                "delivery:branch:branch-1:single:delivery-1",
                "delivery:admin:list",
                "delivery:admin:name",
                "delivery:admin:single:delivery-1",
                "delivery:public:list",
                "delivery:public:name",
                "delivery:public:single:delivery-1",
            ])
        );
    });

    it("blocks delivery deletion when orders still reference the provider", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "delivery-1",
                delivery_name: "Grab",
                branch_id: "branch-1",
            }),
            delete: vi.fn(),
        };
        getRepositoryMock.mockReturnValue({
            count: vi.fn().mockResolvedValue(1),
        });

        const service = new DeliveryService(model as any);

        await expect(service.delete("delivery-1", "branch-1")).rejects.toThrow(
            "Delivery provider cannot be deleted because it is referenced by orders"
        );
        expect(model.delete).not.toHaveBeenCalled();
    });
});
