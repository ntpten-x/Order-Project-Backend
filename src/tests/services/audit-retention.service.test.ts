import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    dbQueryMock,
    runWithDbContextMock,
} = vi.hoisted(() => ({
    dbQueryMock: vi.fn(),
    runWithDbContextMock: vi.fn(async (_params: unknown, fn: () => Promise<unknown>) => fn()),
}));

vi.mock("../../database/dbContext", () => ({
    getDbManager: () => ({ query: dbQueryMock }),
    runWithDbContext: runWithDbContextMock,
    runInTransaction: vi.fn(),
}));

describe("audit retention service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns dry-run result when dryRun=true", async () => {
        dbQueryMock.mockResolvedValueOnce([{ count: 12 }]);

        const { cleanupAuditLogsOlderThan } = await import("../../services/maintenance/orderRetention.service");
        const result = await cleanupAuditLogsOlderThan({ retentionDays: 7, dryRun: true });

        expect(result.dryRun).toBe(true);
        expect(result.candidateCount).toBe(12);
        expect(result.deleted).toBe(0);
        expect(result.batchesProcessed).toBe(0);
    });

    it("deletes audit logs in batches", async () => {
        dbQueryMock
            .mockResolvedValueOnce([{ count: 3 }]) // count candidates
            .mockResolvedValueOnce([{ id: "a1" }, { id: "a2" }]) // batch 1 ids
            .mockResolvedValueOnce([{ count: 2 }]) // batch 1 delete count
            .mockResolvedValueOnce([{ id: "a3" }]) // batch 2 ids
            .mockResolvedValueOnce([{ count: 1 }]) // batch 2 delete count
            .mockResolvedValueOnce([]); // next ids = done

        const { cleanupAuditLogsOlderThan } = await import("../../services/maintenance/orderRetention.service");
        const result = await cleanupAuditLogsOlderThan({
            retentionDays: 7,
            dryRun: false,
            batchSize: 2,
            maxBatches: 10,
        });

        expect(result.dryRun).toBe(false);
        expect(result.candidateCount).toBe(3);
        expect(result.deleted).toBe(3);
        expect(result.batchesProcessed).toBe(2);
        expect(runWithDbContextMock).toHaveBeenCalled();
    });
});

