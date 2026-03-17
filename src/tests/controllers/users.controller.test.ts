import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersController } from "../../controllers/users.controller";

const { auditLogMock } = vi.hoisted(() => ({
    auditLogMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/auditLogger", () => ({
    auditLogger: {
        log: auditLogMock,
    },
    AuditActionType: {
        USER_CREATE: "USER_CREATE",
        USER_UPDATE: "USER_UPDATE",
        USER_DELETE: "USER_DELETE",
    },
    getUserInfoFromRequest: vi.fn().mockReturnValue({
        user_id: "actor-1",
        username: "admin",
        branch_id: "branch-1",
    }),
}));

vi.mock("../../utils/securityLogger", () => ({
    getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

function createResponseMock() {
    const response = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        setHeader: vi.fn(),
        send: vi.fn().mockReturnThis(),
    };

    return response as any;
}

async function flushAsyncWork() {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("UsersController sanitization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("removes password hashes from paginated user list responses", async () => {
        const usersService = {
            findAllPaginated: vi.fn().mockResolvedValue({
                data: [
                    {
                        id: "u1",
                        username: "alice",
                        password: "hashed-password",
                        roles: { roles_name: "Employee" },
                    },
                ],
                total: 1,
                page: 1,
                limit: 20,
            }),
        };
        const controller = new UsersController(usersService as any);
        const req = {
            query: {},
            permission: { scope: "branch" },
            user: { id: "actor-1" },
        } as any;
        const res = createResponseMock();
        const next = vi.fn();

        controller.findAll(req, res, next);
        await flushAsyncWork();

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: [
                {
                    id: "u1",
                    username: "alice",
                    roles: { roles_name: "Employee" },
                },
            ],
            meta: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
            },
        });
    });

    it("removes password hashes from create responses", async () => {
        const usersService = {
            create: vi.fn().mockResolvedValue({
                id: "u2",
                username: "bob",
                password: "hashed-password",
                name: "Bob",
            }),
        };
        const controller = new UsersController(usersService as any);
        const req = {
            body: {
                username: "bob",
                name: "Bob",
                password: "plaintext",
            },
            get: vi.fn().mockReturnValue("jest"),
            originalUrl: "/users",
            method: "POST",
        } as any;
        const res = createResponseMock();
        const next = vi.fn();

        controller.create(req, res, next);
        await flushAsyncWork();

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                id: "u2",
                username: "bob",
                name: "Bob",
            },
        });
    });
});
