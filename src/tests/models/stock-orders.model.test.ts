import { beforeEach, describe, expect, it, vi } from "vitest";
import { PurchaseOrderStatus } from "../../entity/stock/PurchaseOrder";
import { StockOrdersModel } from "../../models/stock/orders.model";

const { getRepositoryMock, runInTransactionMock } = vi.hoisted(() => ({
    getRepositoryMock: vi.fn(),
    runInTransactionMock: vi.fn(),
}));

vi.mock("../../database/dbContext", () => ({
    getRepository: getRepositoryMock,
    runInTransaction: runInTransactionMock,
}));

function createIngredientQueryBuilder(rows: Array<{ id: string; is_active: boolean }>) {
    return {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue(rows),
    };
}

describe("stock orders model", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects creating an order with inactive ingredients", async () => {
        const ingredientQuery = createIngredientQueryBuilder([
            { id: "ingredient-inactive", is_active: false },
        ]);
        const manager = {
            getRepository: vi.fn().mockReturnValue({
                createQueryBuilder: vi.fn().mockReturnValue(ingredientQuery),
            }),
            create: vi.fn(),
            save: vi.fn(),
        };

        runInTransactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(manager));

        const model = new StockOrdersModel();

        await expect(
            model.createOrderWithItems(
                "user-1",
                [{ ingredient_id: "ingredient-inactive", quantity_ordered: 1 }],
                "test order",
                "branch-1"
            )
        ).rejects.toThrow("inactive");

        expect(manager.save).not.toHaveBeenCalled();
    });

    it("rejects adding a new inactive ingredient while editing a pending order", async () => {
        const ingredientQuery = createIngredientQueryBuilder([
            { id: "ingredient-existing", is_active: false },
            { id: "ingredient-inactive-new", is_active: false },
        ]);
        const manager = {
            getRepository: vi.fn().mockReturnValue({
                createQueryBuilder: vi.fn().mockReturnValue(ingredientQuery),
            }),
            findOne: vi.fn().mockResolvedValue({
                id: "order-1",
                branch_id: "branch-1",
                status: PurchaseOrderStatus.PENDING,
            }),
            find: vi.fn().mockResolvedValue([
                {
                    id: "item-1",
                    orders_id: "order-1",
                    ingredient_id: "ingredient-existing",
                    quantity_ordered: 1,
                },
            ]),
            remove: vi.fn(),
            save: vi.fn(),
            create: vi.fn(),
        };

        runInTransactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(manager));

        const model = new StockOrdersModel();

        await expect(
            model.updateOrderItems(
                "order-1",
                [
                    { ingredient_id: "ingredient-existing", quantity_ordered: 1 },
                    { ingredient_id: "ingredient-inactive-new", quantity_ordered: 1 },
                ],
                "branch-1"
            )
        ).rejects.toThrow("inactive");

        expect(manager.save).not.toHaveBeenCalled();
        expect(manager.remove).not.toHaveBeenCalled();
    });
});
