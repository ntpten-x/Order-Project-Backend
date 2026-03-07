import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrintSettingsService } from "../../services/pos/printSettings.service";
import { createDefaultPrintSettingsPayload } from "../../utils/printSettings";

const {
    emitToBranchMock,
    invalidateCacheMock,
    getRepositoryMock,
} = vi.hoisted(() => ({
    emitToBranchMock: vi.fn(),
    invalidateCacheMock: vi.fn(),
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
    getRepository: getRepositoryMock,
}));

vi.mock("../../utils/cache", () => ({
    cacheKey: (...parts: Array<string | number | boolean | undefined>) =>
        parts.map((part) => (part === undefined ? "" : String(part))).join(":"),
    invalidateCache: invalidateCacheMock,
    queryCache: {},
    withCache: async <T,>(_: string, fetcher: () => Promise<T>) => fetcher(),
}));

describe("print settings service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRepositoryMock.mockReturnValue({
            findOne: vi.fn().mockResolvedValue({ id: "branch-1" }),
        });
    });

    it("creates defaults when branch has no print settings yet", async () => {
        const defaults = {
            id: "settings-1",
            branch_id: "branch-1",
            ...createDefaultPrintSettingsPayload(),
        };
        const model = {
            findByBranchId: vi.fn().mockResolvedValue(null),
            createOrUpdate: vi.fn().mockResolvedValue(defaults),
        };

        const service = new PrintSettingsService(model as any);
        const result = await service.getSettings("branch-1");

        expect(model.findByBranchId).toHaveBeenCalledWith("branch-1");
        expect(model.createOrUpdate).toHaveBeenCalledWith("branch-1", createDefaultPrintSettingsPayload());
        expect(result).toEqual(defaults);
    });

    it("skips persistence, cache invalidation, and realtime emit when update is a no-op after normalization", async () => {
        const existing = {
            id: "settings-1",
            branch_id: "branch-1",
            ...createDefaultPrintSettingsPayload(),
        };
        const model = {
            findByBranchId: vi.fn().mockResolvedValue(existing),
            createOrUpdate: vi.fn(),
        };

        const service = new PrintSettingsService(model as any);
        const result = await service.updateSettings("branch-1", {
            locale: "  th-TH  ",
            documents: existing.documents,
            automation: existing.automation,
            default_unit: existing.default_unit,
            allow_manual_override: existing.allow_manual_override,
        });

        expect(result).toEqual(existing);
        expect(model.createOrUpdate).not.toHaveBeenCalled();
        expect(invalidateCacheMock).not.toHaveBeenCalled();
        expect(emitToBranchMock).not.toHaveBeenCalled();
    });

    it("persists, invalidates cache, and emits realtime update when values change", async () => {
        const existing = {
            id: "settings-1",
            branch_id: "branch-1",
            ...createDefaultPrintSettingsPayload(),
        };
        const updated = {
            ...existing,
            locale: "en-US",
        };
        const model = {
            findByBranchId: vi.fn().mockResolvedValue(existing),
            createOrUpdate: vi.fn().mockResolvedValue(updated),
        };

        const service = new PrintSettingsService(model as any);
        const result = await service.updateSettings("branch-1", { locale: "  en-US  " });

        expect(model.createOrUpdate).toHaveBeenCalledWith(
            "branch-1",
            expect.objectContaining({
                locale: "en-US",
            })
        );
        expect(invalidateCacheMock).toHaveBeenCalledWith(["print-settings:branch:branch-1:single"]);
        expect(emitToBranchMock).toHaveBeenCalledWith(
            "branch-1",
            "printSettings:update",
            updated
        );
        expect(result).toEqual(updated);
    });
});
