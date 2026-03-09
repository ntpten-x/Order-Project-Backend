import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductsService } from "../../services/pos/products.service";
import { DiscountsService } from "../../services/pos/discounts.service";
import { PaymentMethodService } from "../../services/pos/paymentMethod.service";
import { PaymentAccountService } from "../../services/pos/PaymentAccount.service";

const {
    emitToBranchMock,
    invalidateCacheMock,
    getDbContextMock,
    getRepositoryMock,
} = vi.hoisted(() => ({
    emitToBranchMock: vi.fn(),
    invalidateCacheMock: vi.fn(),
    getDbContextMock: vi.fn(),
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
    getDbContext: getDbContextMock,
    getRepository: getRepositoryMock,
}));

vi.mock("../../utils/cache", () => ({
    cacheKey: (...parts: Array<string | number | boolean | undefined>) =>
        parts.map((part) => (part === undefined ? "" : String(part))).join(":"),
    invalidateCache: invalidateCacheMock,
    queryCache: {},
    withCache: async <T,>(_: string, fetcher: () => Promise<T>) => fetcher(),
}));

describe("products, discounts, and payment method services", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDbContextMock.mockReturnValue({ branchId: "branch-1", isAdmin: false });
    });

    it("normalizes products and skips duplicate checks for casing-only updates", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "product-1",
                display_name: "Americano",
                price_delivery: 70,
                branch_id: "branch-1",
            }),
            findOneByName: vi.fn(),
            update: vi.fn().mockResolvedValue({ id: "product-1" }),
        };

        const service = new ProductsService(model as any);
        await service.update(
            "product-1",
            {
                display_name: " americano ",
            } as any,
            "branch-1"
        );

        expect(model.findOneByName).not.toHaveBeenCalled();
        expect(model.update).toHaveBeenCalledWith(
            "product-1",
            expect.objectContaining({
                display_name: "americano",
                branch_id: "branch-1",
            }),
            "branch-1"
        );
    });

    it("blocks product deletion when order items still reference the product", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "product-1",
                display_name: "americano",
                branch_id: "branch-1",
            }),
            delete: vi.fn(),
        };
        getRepositoryMock.mockReturnValue({
            count: vi.fn().mockResolvedValue(2),
        });

        const service = new ProductsService(model as any);

        await expect(service.delete("product-1", "branch-1")).rejects.toThrow(
            "Product cannot be deleted because it is referenced by order items"
        );
        expect(model.delete).not.toHaveBeenCalled();
    });

    it("normalizes discount names and invalidates caches across scopes", async () => {
        const model = {
            findOneByName: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(async (input) => ({
                id: "discount-1",
                branch_id: "branch-1",
                ...input,
            })),
        };

        const service = new DiscountsService(model as any);
        const result = await service.create(
            {
                branch_id: "branch-1",
                display_name: "  VIP  ",
                description: "  Member discount  ",
            } as any,
            "branch-1"
        );

        expect(model.findOneByName).toHaveBeenCalledWith("VIP", "branch-1");
        expect(model.create).toHaveBeenCalledWith(
            expect.objectContaining({
                display_name: "VIP",
                description: "Member discount",
                branch_id: "branch-1",
            })
        );
        expect(result).toEqual(
            expect.objectContaining({
                display_name: "VIP",
            })
        );
        expect(invalidateCacheMock).toHaveBeenCalledWith(
            expect.arrayContaining([
                "discounts:branch:branch-1:list",
                "discounts:branch:branch-1:list-all",
                "discounts:branch:branch-1:name",
                "discounts:branch:branch-1:single:discount-1",
                "discounts:admin:list",
                "discounts:admin:list-all",
                "discounts:admin:name",
                "discounts:admin:single:discount-1",
                "discounts:public:list",
                "discounts:public:list-all",
                "discounts:public:name",
                "discounts:public:single:discount-1",
            ])
        );
    });

    it("blocks discount deletion when orders still reference the discount", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "discount-1",
                display_name: "VIP",
                branch_id: "branch-1",
            }),
            delete: vi.fn(),
        };
        getRepositoryMock.mockReturnValue({
            count: vi.fn().mockResolvedValue(1),
        });

        const service = new DiscountsService(model as any);

        await expect(service.delete("discount-1", "branch-1")).rejects.toThrow(
            "Discount cannot be deleted because it is referenced by orders"
        );
        expect(model.delete).not.toHaveBeenCalled();
    });

    it("normalizes payment methods and invalidates caches across scopes", async () => {
        const model = {
            findOneByName: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(async (input) => ({
                id: "payment-1",
                branch_id: "branch-1",
                ...input,
            })),
        };

        const service = new PaymentMethodService(model as any);
        const result = await service.create(
            {
                branch_id: "branch-1",
                payment_method_name: "  PromptPay  ",
                display_name: "  PromptPay  ",
            } as any,
            "branch-1"
        );

        expect(model.findOneByName).toHaveBeenCalledWith("PromptPay", "branch-1");
        expect(model.create).toHaveBeenCalledWith(
            expect.objectContaining({
                payment_method_name: "PromptPay",
                display_name: "PromptPay",
                branch_id: "branch-1",
            })
        );
        expect(result).toEqual(
            expect.objectContaining({
                payment_method_name: "PromptPay",
                display_name: "PromptPay",
            })
        );
        expect(invalidateCacheMock).toHaveBeenCalledWith(
            expect.arrayContaining([
                "payment-method:branch:branch-1:list",
                "payment-method:branch:branch-1:name",
                "payment-method:branch:branch-1:single:payment-1",
                "payment-method:admin:list",
                "payment-method:admin:name",
                "payment-method:admin:single:payment-1",
                "payment-method:public:list",
                "payment-method:public:name",
                "payment-method:public:single:payment-1",
            ])
        );
    });

    it("blocks payment method deletion when payments still reference it", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "payment-1",
                payment_method_name: "PromptPay",
                branch_id: "branch-1",
            }),
            delete: vi.fn(),
        };
        getRepositoryMock.mockReturnValue({
            count: vi.fn().mockResolvedValue(4),
        });

        const service = new PaymentMethodService(model as any);

        await expect(service.delete("payment-1", "branch-1")).rejects.toThrow(
            "Payment method cannot be deleted because it is referenced by payments"
        );
        expect(model.delete).not.toHaveBeenCalled();
    });

    it("normalizes payment accounts and invalidates caches across scopes", async () => {
        const model = {
            findByAccountNumber: vi.fn().mockResolvedValue(null),
            count: vi.fn().mockResolvedValue(0),
            deactivateAll: vi.fn(),
            create: vi.fn().mockImplementation(async (input) => ({
                id: "account-1",
                ...input,
            })),
        };

        getRepositoryMock.mockImplementation((entity) => {
            if (typeof entity === "function" && entity.name === "Branch") {
                return {
                    findOne: vi.fn().mockResolvedValue({ id: "branch-1" }),
                };
            }
            return {
                findOne: vi.fn().mockResolvedValue({ id: "shop-1", branch_id: "branch-1" }),
                update: vi.fn().mockResolvedValue(undefined),
                save: vi.fn().mockResolvedValue({ id: "shop-1", branch_id: "branch-1" }),
            };
        });

        const service = new PaymentAccountService(model as any);
        const created = await service.createAccount("branch-1", {
            account_name: "  Main PromptPay  ",
            account_number: "123-456-7890",
            phone: "081-234-5678",
            address: "  Front counter  ",
            is_active: true,
        } as any);

        expect(model.findByAccountNumber).toHaveBeenCalledWith("shop-1", "1234567890", "branch-1");
        expect(model.create).toHaveBeenCalledWith(
            expect.objectContaining({
                branch_id: "branch-1",
                shop_id: "shop-1",
                account_name: "Main PromptPay",
                account_number: "1234567890",
                phone: "0812345678",
                address: "Front counter",
                account_type: "PromptPay",
                is_active: true,
            })
        );
        expect(created).toEqual(
            expect.objectContaining({
                account_name: "Main PromptPay",
                account_number: "1234567890",
            })
        );
        expect(invalidateCacheMock).toHaveBeenCalledWith(
            expect.arrayContaining([
                "payment-accounts:branch:branch-1:list",
                "payment-accounts:branch:branch-1:list-all",
                "payment-accounts:branch:branch-1:single",
                "payment-accounts:branch:branch-1:number",
                "payment-accounts:branch:branch-1:single:account-1",
                "payment-accounts:admin:list",
                "payment-accounts:admin:list-all",
                "payment-accounts:admin:single",
                "payment-accounts:admin:number",
                "payment-accounts:admin:single:account-1",
                "payment-accounts:public:list",
                "payment-accounts:public:list-all",
                "payment-accounts:public:single",
                "payment-accounts:public:number",
                "payment-accounts:public:single:account-1",
            ])
        );
    });

    it("rejects payment account updates with invalid phone digits", async () => {
        const model = {
            findOne: vi.fn().mockResolvedValue({
                id: "account-1",
                shop_id: "shop-1",
                account_name: "PromptPay",
                account_number: "1234567890",
                branch_id: "branch-1",
                is_active: false,
            }),
        };

        getRepositoryMock.mockImplementation((entity) => {
            if (typeof entity === "function" && entity.name === "Branch") {
                return {
                    findOne: vi.fn().mockResolvedValue({ id: "branch-1" }),
                };
            }
            return {
                findOne: vi.fn().mockResolvedValue({ id: "shop-1", branch_id: "branch-1" }),
                update: vi.fn().mockResolvedValue(undefined),
                save: vi.fn().mockResolvedValue({ id: "shop-1", branch_id: "branch-1" }),
            };
        });

        const service = new PaymentAccountService(model as any);

        await expect(
            service.updateAccount("branch-1", "account-1", {
                phone: "08123",
            } as any)
        ).rejects.toThrow("Phone number must be 10 digits");
    });
});
