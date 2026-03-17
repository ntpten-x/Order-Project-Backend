import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRepositoryMock, runWithDbContextMock } = vi.hoisted(() => ({
    getRepositoryMock: vi.fn(),
    runWithDbContextMock: vi.fn(),
}));

vi.mock("../../database/dbContext", () => ({
    getRepository: getRepositoryMock,
    runWithDbContext: runWithDbContextMock,
}));

vi.mock("../../database/database", () => ({
    AppDataSource: {
        getRepository: vi.fn(),
        manager: {},
    },
}));

vi.mock("../../utils/securityLogger", () => ({
    securityLogger: { log: vi.fn(), checkSuspiciousActivity: vi.fn() },
    getClientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("../../utils/ApiResponse", () => ({
    ApiResponses: {
        unauthorized: vi.fn(),
        forbidden: vi.fn(),
        internalError: vi.fn(),
    },
}));

vi.mock("../../lib/redisClient", () => ({
    getRedisClient: vi.fn(),
    getSessionKey: vi.fn(),
    isRedisConfigured: vi.fn(() => false),
}));

import { resolveAdminSelectedBranchId } from "../../middleware/auth.middleware";
import { Branch } from "../../entity/Branch";

describe("auth middleware", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runWithDbContextMock.mockImplementation(async (_params, fn: () => Promise<unknown>) => fn());
    });

    it("resolves admin-selected branch under admin db context", async () => {
        const findOneBy = vi.fn().mockResolvedValue({ id: "branch-2" });
        getRepositoryMock.mockImplementation((entity: unknown) => {
            expect(entity).toBe(Branch);
            return { findOneBy };
        });

        const result = await resolveAdminSelectedBranchId("branch-2");

        expect(runWithDbContextMock).toHaveBeenCalledWith(
            { isAdmin: true },
            expect.any(Function)
        );
        expect(findOneBy).toHaveBeenCalledWith({
            id: "branch-2",
            is_active: true,
        });
        expect(result).toBe("branch-2");
    });

    it("returns null when selected branch is inactive or hidden", async () => {
        const findOneBy = vi.fn().mockResolvedValue(null);
        getRepositoryMock.mockReturnValue({ findOneBy });

        const result = await resolveAdminSelectedBranchId("branch-missing");

        expect(result).toBeNull();
    });
});
