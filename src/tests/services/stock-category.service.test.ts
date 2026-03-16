import { beforeEach, describe, expect, it, vi } from "vitest";
import { StockCategoryService } from "../../services/stock/category.service";

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
    metadataCache: {},
    withCache: async <T,>(_: string, fetcher: () => Promise<T>) => fetcher(),
}));

describe("stock category service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDbContextMock.mockReturnValue({ branchId: "branch-1", isAdmin: false });
    });

    it("normalizes display names and invalidates caches across scopes on create", async () => {
        const model = {
            findOneByName: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(async (input) => ({
                id: "stock-category-1",
                ...input,
            })),
        };

        const service = new StockCategoryService(model as any);
        const result = await service.create(
            {
                branch_id: "branch-1",
                display_name: "  Fresh Herbs  ",
                is_active: true,
            } as any,
            "branch-1"
        );

        expect(model.findOneByName).toHaveBeenCalledWith("Fresh Herbs", "branch-1");
        expect(model.create).toHaveBeenCalledWith(
            expect.objectContaining({
                branch_id: "branch-1",
                display_name: "Fresh Herbs",
            })
        );
        expect(invalidateCacheMock).toHaveBeenCalledWith(
            expect.arrayContaining([
                "stock_category:branch:branch-1:list",
                "stock_category:branch:branch-1:name",
                "stock_category:branch:branch-1:single:stock-category-1",
                "stock_category:admin:list",
                "stock_category:admin:name",
                "stock_category:admin:single:stock-category-1",
                "stock_category:public:list",
                "stock_category:public:name",
                "stock_category:public:single:stock-category-1",
            ])
        );
        expect(emitToBranchMock).toHaveBeenCalledWith("branch-1", "stock:category:create", result);
        expect(result.display_name).toBe("Fresh Herbs");
    });

    it("passes list filters into the model for non-paginated reads", async () => {
        const model = {
            findAll: vi.fn().mockResolvedValue([]),
        };

        const service = new StockCategoryService(model as any);
        await service.findAll("branch-1", "new", { q: "veg", status: "active" });

        expect(model.findAll).toHaveBeenCalledWith("branch-1", "new", {
            q: "veg",
            status: "active",
        });
    });

    it("blocks deletion when ingredients still reference the category", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "stock-category-1",
                display_name: "Fresh Herbs",
                branch_id: "branch-1",
            }),
            delete: vi.fn(),
        };
        getRepositoryMock.mockReturnValue({
            count: vi.fn().mockResolvedValue(2),
        });

        const service = new StockCategoryService(model as any);

        await expect(service.delete("stock-category-1", "branch-1")).rejects.toThrow();
        expect(model.delete).not.toHaveBeenCalled();
    });
});
