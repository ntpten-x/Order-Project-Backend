import { beforeEach, describe, expect, it, vi } from "vitest";
import { PurchaseOrderStatus } from "../../entity/stock/PurchaseOrder";
import { OrdersService } from "../../services/stock/orders.service";

const {
    emitToBranchMock,
    invalidateCacheMock,
    getDbContextMock,
} = vi.hoisted(() => ({
    emitToBranchMock: vi.fn(),
    invalidateCacheMock: vi.fn(),
    getDbContextMock: vi.fn(),
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
}));

vi.mock("../../utils/cache", () => ({
    cacheKey: (...parts: Array<string | number | boolean | undefined>) =>
        parts.map((part) => (part === undefined ? "" : String(part))).join(":"),
    invalidateCache: invalidateCacheMock,
    queryCache: {},
    withCache: async <T,>(_: string, fetcher: () => Promise<T>) => fetcher(),
}));

describe("stock orders service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDbContextMock.mockReturnValue({ branchId: "branch-1", isAdmin: false });
    });

    it("invalidates branch, admin, and public caches when creating orders", async () => {
        const model = {
            createOrderWithItems: vi.fn().mockResolvedValue({
                id: "order-1",
                branch_id: "branch-1",
                status: PurchaseOrderStatus.PENDING,
            }),
        };

        const service = new OrdersService(model as any);
        const result = await service.createOrder(
            "user-1",
            [{ ingredient_id: "ingredient-1", quantity_ordered: 2 }],
            "restock basil",
            "branch-1"
        );

        expect(model.createOrderWithItems).toHaveBeenCalledWith(
            "user-1",
            [{ ingredient_id: "ingredient-1", quantity_ordered: 2 }],
            "restock basil",
            "branch-1"
        );
        expect(invalidateCacheMock).toHaveBeenCalledWith(
            expect.arrayContaining([
                "stock:orders:branch:branch-1:list",
                "stock:orders:branch:branch-1:single",
                "stock:orders:admin:list",
                "stock:orders:admin:single",
                "stock:orders:public:list",
                "stock:orders:public:single",
            ])
        );
        expect(emitToBranchMock).toHaveBeenCalledWith("branch-1", "stock:orders:create", result);
    });
});
