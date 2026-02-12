import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, observePermissionCheckMock, observeCacheMock } = vi.hoisted(() => ({
    queryMock: vi.fn(),
    observePermissionCheckMock: vi.fn(),
    observeCacheMock: vi.fn(),
}));

vi.mock("../../database/dbContext", () => ({
    getDbManager: () => ({
        query: queryMock,
    }),
}));

vi.mock("../../utils/metrics", () => ({
    metrics: {
        observePermissionCheck: observePermissionCheckMock,
        observeCache: observeCacheMock,
    },
}));

import { authorizePermission } from "../../middleware/permission.middleware";
import { clearPermissionDecisionMemoryCache } from "../../utils/permissionCache";

function makeRes() {
    return {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    };
}

describe("permission middleware", () => {
    beforeEach(() => {
        queryMock.mockReset();
        observePermissionCheckMock.mockReset();
        observeCacheMock.mockReset();
        clearPermissionDecisionMemoryCache();
    });

    it("attaches permission and calls next on allow", async () => {
        queryMock.mockResolvedValue([{ effect: "allow", scope: "branch" }]);
        const req: any = {
            user: { id: "u1", roles_id: "r1" },
        };
        const res = makeRes();
        const next = vi.fn();

        await authorizePermission("orders.page", "view")(req, res as any, next);

        expect(next).toHaveBeenCalledOnce();
        expect(req.permission).toEqual({
            resourceKey: "orders.page",
            actionKey: "view",
            scope: "branch",
        });
        expect(observePermissionCheckMock).toHaveBeenCalledWith(
            expect.objectContaining({
                resource: "orders.page",
                action: "view",
                decision: "allow",
                scope: "branch",
            })
        );
    });

    it("returns machine-friendly forbidden payload on deny", async () => {
        queryMock.mockResolvedValue([{ effect: "deny", scope: "none" }]);
        const req: any = {
            user: { id: "u1", roles_id: "r1" },
        };
        const res = makeRes();
        const next = vi.fn();

        await authorizePermission("orders.page", "delete")(req, res as any, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: "FORBIDDEN",
                    details: expect.objectContaining({
                        resource: "orders.page",
                        action: "delete",
                        scope: "none",
                    }),
                }),
            })
        );
        expect(observePermissionCheckMock).toHaveBeenCalledWith(
            expect.objectContaining({
                decision: "deny",
            })
        );
    });
});
