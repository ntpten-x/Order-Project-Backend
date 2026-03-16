import { beforeEach, describe, expect, it, vi } from "vitest";
import { IngredientsService } from "../../services/stock/ingredients.service";

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

describe("stock ingredients service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDbContextMock.mockReturnValue({ branchId: "branch-1", isAdmin: false });
    });

    it("normalizes display name and invalidates caches across scopes on create", async () => {
        const model = {
            findOneByDisplayName: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(async (input) => ({
                id: "ingredient-1",
                ...input,
            })),
            findOne: vi.fn().mockResolvedValue({
                id: "ingredient-1",
                branch_id: "branch-1",
                display_name: "Fresh Basil",
                unit_id: "unit-1",
                category_id: null,
                is_active: true,
            }),
        };

        getRepositoryMock
            .mockReturnValueOnce({
                findOne: vi.fn().mockResolvedValue({ id: "unit-1", branch_id: "branch-1", is_active: true }),
            });

        const service = new IngredientsService(model as any);
        const result = await service.create(
            {
                branch_id: "branch-1",
                display_name: "  Fresh Basil  ",
                description: "  herb  ",
                unit_id: "unit-1",
                category_id: null,
                is_active: true,
            } as any,
            "branch-1"
        );

        expect(model.findOneByDisplayName).toHaveBeenCalledWith("Fresh Basil", "branch-1");
        expect(model.create).toHaveBeenCalledWith(
            expect.objectContaining({
                branch_id: "branch-1",
                display_name: "Fresh Basil",
                description: "herb",
            })
        );
        expect(invalidateCacheMock).toHaveBeenCalledWith(
            expect.arrayContaining([
                "ingredients:branch:branch-1:list",
                "ingredients:branch:branch-1:list_page",
                "ingredients:branch:branch-1:single:ingredient-1",
                "ingredients:admin:list",
                "ingredients:public:list",
            ])
        );
        expect(emitToBranchMock).toHaveBeenCalledWith("branch-1", "ingredients:create", result);
        expect(result.display_name).toBe("Fresh Basil");
    });

    it("rejects assigning an inactive category on create", async () => {
        const model = {
            findOneByDisplayName: vi.fn(),
        };

        getRepositoryMock
            .mockReturnValueOnce({
                findOne: vi.fn().mockResolvedValue({ id: "unit-1", branch_id: "branch-1", is_active: true }),
            })
            .mockReturnValueOnce({
                findOne: vi.fn().mockResolvedValue({ id: "category-1", branch_id: "branch-1", is_active: false }),
            });

        const service = new IngredientsService(model as any);

        await expect(
            service.create(
                {
                    branch_id: "branch-1",
                    display_name: "Tomato",
                    description: "",
                    unit_id: "unit-1",
                    category_id: "category-1",
                    is_active: true,
                } as any,
                "branch-1"
            )
        ).rejects.toThrow();
    });

    it("blocks deletion when stock order items still reference the ingredient", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "ingredient-1",
                display_name: "Fresh Basil",
                branch_id: "branch-1",
            }),
            delete: vi.fn(),
        };
        getRepositoryMock.mockReturnValue({
            count: vi.fn().mockResolvedValue(2),
        });

        const service = new IngredientsService(model as any);

        await expect(service.delete("ingredient-1", "branch-1")).rejects.toThrow();
        expect(model.delete).not.toHaveBeenCalled();
    });
});
