import { beforeEach, describe, expect, it, vi } from "vitest";
import { IngredientsModel } from "../../models/stock/ingredients.model";

const { getRepositoryMock, saveMock } = vi.hoisted(() => ({
    getRepositoryMock: vi.fn(),
    saveMock: vi.fn(),
}));

vi.mock("../../database/dbContext", () => ({
    getRepository: getRepositoryMock,
}));

describe("stock ingredients model", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRepositoryMock.mockReturnValue({
            save: saveMock,
        });
    });

    it("strips joined relation objects before saving updates", async () => {
        saveMock.mockResolvedValue({
            id: "ingredient-1",
            branch_id: "branch-1",
            unit_id: "unit-1",
            category_id: null,
        });

        const model = new IngredientsModel();
        await model.update(
            "ingredient-1",
            {
                id: "ingredient-1",
                branch_id: "branch-1",
                display_name: "Fresh Basil",
                unit_id: "unit-1",
                category_id: null,
                unit: {
                    id: "unit-legacy",
                    display_name: "Legacy Unit",
                } as any,
                category: {
                    id: "category-legacy",
                    display_name: "Legacy Category",
                } as any,
                branch: {
                    id: "branch-legacy",
                    name: "Legacy Branch",
                } as any,
            } as any,
            "branch-1"
        );

        expect(saveMock).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "ingredient-1",
                branch_id: "branch-1",
                unit_id: "unit-1",
                category_id: null,
            })
        );

        const payload = saveMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(payload).not.toHaveProperty("unit");
        expect(payload).not.toHaveProperty("category");
        expect(payload).not.toHaveProperty("branch");
    });
});
