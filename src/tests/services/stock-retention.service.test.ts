import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
    const dbQueryMock = vi.fn();
    const txQueryMock = vi.fn();
    const runWithDbContextMock = vi.fn(async (_params: unknown, fn: () => Promise<unknown>) => fn());
    const runInTransactionMock = vi.fn(async (fn: (manager: any) => Promise<unknown>) => fn({ query: txQueryMock }));
    return {
        dbQueryMock,
        txQueryMock,
        runWithDbContextMock,
        runInTransactionMock,
    };
});

const { dbQueryMock, txQueryMock, runWithDbContextMock, runInTransactionMock } = hoisted;

vi.mock("../../database/dbContext", () => ({
    getDbManager: () => ({ query: dbQueryMock }),
    runWithDbContext: runWithDbContextMock,
    runInTransaction: runInTransactionMock,
}));

describe("stock retention service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns dry-run result without deleting rows", async () => {
        dbQueryMock.mockResolvedValueOnce([{ count: 3 }]);

        const { cleanupCompletedStockOrdersOlderThan } = await import("../../services/maintenance/orderRetention.service");
        const result = await cleanupCompletedStockOrdersOlderThan({ retentionDays: 7, dryRun: true });

        expect(result.dryRun).toBe(true);
        expect(result.candidateOrders).toBe(3);
        expect(result.deleted).toEqual({ orders: 0, items: 0, details: 0 });
        expect(runInTransactionMock).not.toHaveBeenCalled();
    });

    it("deletes only completed stock orders older than cutoff in batches", async () => {
        dbQueryMock
            .mockResolvedValueOnce([{ count: 2 }])
            .mockResolvedValueOnce([{ id: "order-1" }])
            .mockResolvedValueOnce([]);

        txQueryMock
            .mockResolvedValueOnce([{ count: 1 }]) // details
            .mockResolvedValueOnce([{ count: 1 }]) // items
            .mockResolvedValueOnce([{ count: 1 }]); // orders

        const { cleanupCompletedStockOrdersOlderThan } = await import("../../services/maintenance/orderRetention.service");
        const result = await cleanupCompletedStockOrdersOlderThan({
            retentionDays: 7,
            statuses: ["completed"],
            dryRun: false,
            batchSize: 100,
            maxBatches: 10,
        });

        expect(result.dryRun).toBe(false);
        expect(result.candidateOrders).toBe(2);
        expect(result.batchesProcessed).toBe(1);
        expect(result.deleted).toEqual({ orders: 1, items: 1, details: 1 });

        expect(runInTransactionMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(3);
    });
});
