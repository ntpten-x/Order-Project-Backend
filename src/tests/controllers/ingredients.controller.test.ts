import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/auditLogger", () => ({
    auditLogger: {
        log: vi.fn().mockResolvedValue(undefined),
    },
    AuditActionType: {
        STOCK_INGREDIENT_CREATE: "STOCK_INGREDIENT_CREATE",
        STOCK_INGREDIENT_UPDATE: "STOCK_INGREDIENT_UPDATE",
        STOCK_INGREDIENT_DELETE: "STOCK_INGREDIENT_DELETE",
    },
    getUserInfoFromRequest: vi.fn(() => ({
        user_id: "tester",
        username: "tester",
        role_name: "Admin",
    })),
}));

vi.mock("../../utils/securityLogger", () => ({
    getClientIp: vi.fn(() => "127.0.0.1"),
}));

import { IngredientsController } from "../../controllers/stock/ingredients.controller";

function createResponseCapture(onJson?: (payload: unknown) => void) {
    const res: any = {};
    res.status = vi.fn().mockImplementation(() => res);
    res.json = vi.fn().mockImplementation((payload: unknown) => {
        onJson?.(payload);
        return res;
    });
    res.send = vi.fn().mockImplementation((payload: unknown) => {
        onJson?.(payload);
        return res;
    });
    return res;
}

async function invokeSuccess(handler: Function, req: Record<string, unknown>) {
    return new Promise<{ res: any; payload: any }>((resolve, reject) => {
        const res = createResponseCapture((payload) => resolve({ res, payload }));
        handler(req, res, (error: unknown) => reject(error));
    });
}

async function invokeError(handler: Function, req: Record<string, unknown>) {
    return new Promise<unknown>((resolve, reject) => {
        const res = createResponseCapture();
        handler(req, res, (error: unknown) => resolve(error));
        setTimeout(() => reject(new Error("Expected handler to call next(error)")), 0);
    });
}

describe("IngredientsController", () => {
    const service = {
        findAllPaginated: vi.fn(),
        findOne: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    };

    const controller = new IngredientsController(service as any);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("maps list filters and branch context correctly", async () => {
        service.findAllPaginated.mockResolvedValue({
            data: [],
            total: 0,
            page: 2,
            limit: 25,
            last_page: 1,
        });

        const req = {
            query: {
                page: "2",
                limit: "25",
                status: "inactive",
                q: "sugar",
                sort_created: "new",
            },
            branchId: "branch-1",
        };

        const { payload } = await invokeSuccess(controller.findAll, req);

        expect(service.findAllPaginated).toHaveBeenCalledWith(
            2,
            25,
            { is_active: false, q: "sugar" },
            "branch-1",
            "new"
        );
        expect(payload).toMatchObject({
            success: true,
            data: [],
        });
    });

    it("normalizes description and image URL before create", async () => {
        service.create.mockResolvedValue({
            id: "ingredient-1",
            display_name: "Sugar",
            branch_id: "branch-1",
        });

        const req = {
            branchId: "branch-1",
            body: {
                display_name: "Sugar",
                description: "  sweet and dry  ",
                img_url: "https://drive.google.com/file/d/abc123/view?usp=sharing",
                unit_id: "unit-1",
            },
            originalUrl: "/stock/ingredients",
            method: "POST",
            get: vi.fn(() => "vitest"),
        };

        await invokeSuccess(controller.create, req);

        expect(service.create).toHaveBeenCalledWith(
            expect.objectContaining({
                branch_id: "branch-1",
                description: "sweet and dry",
                img_url: "https://drive.google.com/uc?export=view&id=abc123",
                unit_id: "unit-1",
            }),
            "branch-1"
        );
    });

    it("returns not found error when ingredient does not exist", async () => {
        service.findOne.mockResolvedValue(null);

        const error = await invokeError(controller.findOne, {
            params: { id: "missing-id" },
            branchId: "branch-1",
        });

        expect(error).toMatchObject({
            statusCode: 404,
            message: "ไม่พบวัตถุดิบ",
        });
    });
});
