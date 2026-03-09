import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryService } from "../../services/pos/category.service";
import { ProductsUnitService } from "../../services/pos/productsUnit.service";

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

describe("category and products unit services", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDbContextMock.mockReturnValue({ branchId: "branch-1", isAdmin: false });
    });

    it("normalizes category display names and invalidates caches across scopes", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "category-1",
                display_name: "Drink",
                branch_id: "branch-1",
            }),
            findOneByName: vi.fn(),
            update: vi.fn().mockResolvedValue({
                id: "category-1",
                display_name: "Drinks Updated",
                branch_id: "branch-1",
            }),
        };

        const service = new CategoryService(model as any);
        await service.update(
            "category-1",
            {
                display_name: "  Drinks Updated  ",
            } as any,
            "branch-1"
        );

        expect(model.findOneByName).toHaveBeenCalledWith("Drinks Updated", "branch-1");
        expect(model.update).toHaveBeenCalledWith(
            "category-1",
            expect.objectContaining({
                display_name: "Drinks Updated",
            }),
            "branch-1"
        );
        expect(invalidateCacheMock).toHaveBeenCalledWith(
            expect.arrayContaining([
                "category:branch:branch-1:list",
                "category:branch:branch-1:name",
                "category:branch:branch-1:single:category-1",
                "category:admin:list",
                "category:admin:name",
                "category:admin:single:category-1",
                "category:public:list",
                "category:public:name",
                "category:public:single:category-1",
            ])
        );
    });

    it("blocks category deletion when products still reference the category", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "category-1",
                display_name: "Drinks",
                branch_id: "branch-1",
            }),
            delete: vi.fn(),
        };
        getRepositoryMock.mockReturnValue({
            count: vi.fn().mockResolvedValue(3),
        });

        const service = new CategoryService(model as any);

        await expect(service.delete("category-1", "branch-1")).rejects.toThrow(
            "Category cannot be deleted because it is referenced by products"
        );
        expect(model.delete).not.toHaveBeenCalled();
    });

    it("normalizes products unit display names during create", async () => {
        const model = {
            findOneByName: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(async (input) => ({
                id: "unit-1",
                branch_id: "branch-1",
                ...input,
            })),
        };

        const service = new ProductsUnitService(model as any);
        const result = await service.create(
            {
                branch_id: "branch-1",
                display_name: "  Plate  ",
                is_active: true,
            } as any,
            "branch-1"
        );

        expect(model.findOneByName).toHaveBeenCalledWith("Plate", "branch-1");
        expect(model.create).toHaveBeenCalledWith(
            expect.objectContaining({
                display_name: "Plate",
                branch_id: "branch-1",
            })
        );
        expect(result).toEqual(
            expect.objectContaining({
                display_name: "Plate",
            })
        );
    });

    it("avoids duplicate checks for casing-only products unit updates", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "unit-1",
                display_name: "Plate",
                branch_id: "branch-1",
            }),
            findOneByName: vi.fn(),
            update: vi.fn().mockResolvedValue({
                id: "unit-1",
                display_name: "PLATE",
                branch_id: "branch-1",
            }),
        };

        const service = new ProductsUnitService(model as any);
        await service.update(
            "unit-1",
            {
                display_name: " PLATE ",
            } as any,
            "branch-1"
        );

        expect(model.findOneByName).not.toHaveBeenCalled();
        expect(model.update).toHaveBeenCalledWith(
            "unit-1",
            expect.objectContaining({
                display_name: "PLATE",
            }),
            "branch-1"
        );
    });

    it("blocks products unit deletion when products still reference the unit", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "unit-1",
                display_name: "Plate",
                branch_id: "branch-1",
            }),
            delete: vi.fn(),
        };
        getRepositoryMock.mockReturnValue({
            count: vi.fn().mockResolvedValue(1),
        });

        const service = new ProductsUnitService(model as any);

        await expect(service.delete("unit-1", "branch-1")).rejects.toThrow(
            "Products unit cannot be deleted because it is referenced by products"
        );
        expect(model.delete).not.toHaveBeenCalled();
    });
});
