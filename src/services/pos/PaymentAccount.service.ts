import { ShopProfile } from "../../entity/pos/ShopProfile"
import { paymentAccountSchema, CreatePaymentAccountDto } from "../../schemas/paymentAccount.schema"
import { PaymentAccountModel } from "../../models/pos/PaymentAccount.model"
import { ShopPaymentAccount } from "../../entity/pos/ShopPaymentAccount"
import { SocketService } from "../socket.service"
import { getRepository } from "../../database/dbContext"
import { RealtimeEvents } from "../../utils/realtimeEvents"
import { AppError } from "../../utils/AppError"
import { Branch } from "../../entity/Branch"
import { cacheKey, invalidateCache, queryCache, withCache } from "../../utils/cache"


export class PaymentAccountService {
    private model: PaymentAccountModel
    private socketService = SocketService.getInstance()
    private readonly CACHE_PREFIX = "payment-accounts"
    private readonly CACHE_TTL = Number(process.env.POS_MASTER_CACHE_TTL_MS || 30_000)

    constructor(model: PaymentAccountModel) {
        this.model = model
    }

    private normalizeDigits(value?: string | null): string | undefined {
        if (typeof value !== "string") return undefined;
        const digits = value.replace(/\D/g, "");
        return digits || undefined;
    }

    private normalizeMutableFields(data: Partial<CreatePaymentAccountDto>): Partial<CreatePaymentAccountDto> {
        const next: Partial<CreatePaymentAccountDto> = { ...data };

        if (next.account_name !== undefined) {
            const accountName = next.account_name.trim();
            if (!accountName) {
                throw AppError.badRequest("Account name is required");
            }
            next.account_name = accountName;
        }

        if (next.account_number !== undefined) {
            const accountNumber = this.normalizeDigits(next.account_number);
            if (!accountNumber) {
                throw AppError.badRequest("Account number is required");
            }
            if (accountNumber.length !== 10) {
                throw AppError.badRequest("PromptPay number must be 10 digits");
            }
            next.account_number = accountNumber;
        }

        if (next.phone !== undefined) {
            const phone = this.normalizeDigits(next.phone);
            if (phone && phone.length !== 10) {
                throw AppError.badRequest("Phone number must be 10 digits");
            }
            next.phone = phone;
        }

        if (next.address !== undefined) {
            next.address = next.address.trim() || undefined;
        }

        if (next.bank_name !== undefined) {
            next.bank_name = next.bank_name.trim() || undefined;
        }

        next.account_type = "PromptPay";
        return next;
    }

    private getCacheScopeParts(branchId?: string): Array<string> {
        if (branchId) return ["branch", branchId];
        return ["public"];
    }

    private getInvalidationPatterns(branchId?: string, accountId?: string): string[] {
        if (!branchId) {
            return [`${this.CACHE_PREFIX}:`];
        }

        const scopes: Array<Array<string>> = [
            ["branch", branchId],
            ["admin"],
            ["public"],
        ];
        const patterns: string[] = [];

        for (const scope of scopes) {
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "list"));
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "list-all"));
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "single"));
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "number"));
            if (accountId) {
                patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "single", accountId));
            }
        }

        return patterns;
    }

    private invalidatePaymentAccountCache(branchId?: string, accountId?: string): void {
        invalidateCache(this.getInvalidationPatterns(branchId, accountId));
    }

    private async ensureBranchExists(branchId: string): Promise<void> {
        const branchRepository = getRepository(Branch);
        const branch = await branchRepository.findOne({ where: { id: branchId } as any });
        if (!branch) {
            throw AppError.badRequest("Invalid branch: branch not found.");
        }
    }

    private throwPersistenceError(error: unknown, fallback: string): never {
        const err = error as { code?: string; message?: string; driverError?: { code?: string } };
        const code = err?.code || err?.driverError?.code;
        const message = err?.message || fallback;
        const lowerMessage = message.toLowerCase();

        if (code === "23505" || lowerMessage.includes("duplicate key") || lowerMessage.includes("unique constraint")) {
            throw AppError.conflict("This account number already exists in your shop.");
        }

        if (code === "23503" || lowerMessage.includes("foreign key constraint")) {
            throw AppError.badRequest("Invalid branch/shop reference. Please verify branch selection.");
        }

        if (code === "23502" || lowerMessage.includes("null value in column")) {
            throw AppError.badRequest("Missing required branch/shop information.");
        }

        if (code === "42501" || lowerMessage.includes("row-level security")) {
            throw AppError.forbidden("Branch access denied for this operation.");
        }

        if (error instanceof Error) {
            throw error;
        }

        throw AppError.internal(fallback);
    }

    private async getShopIdForBranch(branchId: string): Promise<string> {
        await this.ensureBranchExists(branchId);

        const shopRepository = getRepository(ShopProfile)
        const existing = await shopRepository.findOne({ where: { branch_id: branchId } as any });
        if (existing) return existing.id;

        try {
            const created = await shopRepository.save({ branch_id: branchId, shop_name: "POS Shop" } as any);
            return created.id;
        } catch (error) {
            // Handle race condition: another request may create the shop profile first.
            const retry = await shopRepository.findOne({ where: { branch_id: branchId } as any });
            if (retry) return retry.id;
            this.throwPersistenceError(error, "Failed to create shop profile for branch.");
        }
    }

    async findAll(
        branchId: string,
        page: number = 1,
        limit: number = 50,
        q?: string,
        filters?: { status?: "active" | "inactive" }
    ) {
        const shopId = await this.getShopIdForBranch(branchId);
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(
            this.CACHE_PREFIX,
            ...scope,
            "list",
            page,
            limit,
            (q || "").trim().toLowerCase(),
            filters?.status || "all"
        );

        return withCache(
            key,
            () => this.model.findAll(shopId, branchId, page, limit, q, filters),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOne(branchId: string, accountId: string) {
        const shopId = await this.getShopIdForBranch(branchId);
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "single", accountId);

        return withCache(
            key,
            () => this.model.findOne(shopId, accountId, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    // Deprecated: use findAll instead
    async getAccounts(branchId: string) {
        const shopId = await this.getShopIdForBranch(branchId);
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "list-all");

        return withCache(
            key,
            () => this.model.findByShopId(shopId, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async createAccount(branchId: string, data: CreatePaymentAccountDto) {
        const shopId = await this.getShopIdForBranch(branchId);
        const normalizedData = this.normalizeMutableFields(data) as CreatePaymentAccountDto;
        // Zod Validation
        const validation = paymentAccountSchema.safeParse(normalizedData);
        if (!validation.success) {
            throw AppError.badRequest(validation.error.issues[0].message);
        }

        // Check for duplicate account number in this shop
        const existing = await this.model.findByAccountNumber(shopId, normalizedData.account_number, branchId);

        if (existing) throw AppError.conflict("This account number already exists in your shop.");

        const accountData: Partial<ShopPaymentAccount> = {
            branch_id: branchId,
            shop_id: shopId,
            ...normalizedData
        };

        // If this is the first account, make it active
        const count = await this.model.count(shopId, branchId);
        if (count === 0) {
            accountData.is_active = true;
        }

        // If newly created is set to active, deactivate others
        if (accountData.is_active) {
            await this.model.deactivateAll(shopId, branchId);
        }

        let account: ShopPaymentAccount;
        try {
            account = await this.model.create(accountData) as ShopPaymentAccount;

            if (account.is_active) {
                // Sync with ShopProfile
                await this.syncToShopProfile(shopId, account);
            }
        } catch (error) {
            this.throwPersistenceError(error, "Failed to create payment account.");
        }

        this.invalidatePaymentAccountCache(branchId, account.id);
        this.socketService.emitToBranch(branchId, RealtimeEvents.paymentAccounts.create, account);
        return account;
    }

    async updateAccount(branchId: string, accountId: string, data: Partial<CreatePaymentAccountDto>) {
        const shopId = await this.getShopIdForBranch(branchId);
        const account = await this.model.findOne(shopId, accountId, branchId);
        if (!account) throw AppError.notFound("Payment account");
        const normalizedData = this.normalizeMutableFields(data);

        if (normalizedData.account_number) {
            // Validate format
            const validation = paymentAccountSchema.pick({ account_number: true }).safeParse({ account_number: normalizedData.account_number });
            if (!validation.success) {
                throw AppError.badRequest(validation.error.issues[0].message);
            }
            // Check duplicates if changing number
            if (normalizedData.account_number !== account.account_number) {
                const scopedExisting = await this.model.findByAccountNumber(shopId, normalizedData.account_number, branchId);
                if (scopedExisting) throw AppError.conflict("This account number already exists in your shop.");
            }
        }

        Object.assign(account, normalizedData);

        if (account.is_active) {
            await this.model.deactivateAll(shopId, branchId);
            // Ensure it's true after bulk update (though object assignment handles it locally, model needs to save)
            account.is_active = true;
        }

        let savedAccount: ShopPaymentAccount;
        try {
            savedAccount = await this.model.save(account);

            if (savedAccount.is_active) {
                await this.syncToShopProfile(shopId, savedAccount);
            }
        } catch (error) {
            this.throwPersistenceError(error, "Failed to update payment account.");
        }

        this.invalidatePaymentAccountCache(branchId, accountId);
        this.socketService.emitToBranch(branchId, RealtimeEvents.paymentAccounts.update, savedAccount);
        return savedAccount;
    }

    async activateAccount(branchId: string, accountId: string) {
        const shopId = await this.getShopIdForBranch(branchId);
        const account = await this.model.findOne(shopId, accountId, branchId);
        if (!account) throw AppError.notFound("Payment account");

        // Deactivate all
        await this.model.deactivateAll(shopId, branchId);

        // Activate target
        account.is_active = true;
        let savedAccount: ShopPaymentAccount;
        try {
            savedAccount = await this.model.save(account);

            // Sync with ShopProfile
            await this.syncToShopProfile(shopId, savedAccount);
        } catch (error) {
            this.throwPersistenceError(error, "Failed to activate payment account.");
        }

        this.invalidatePaymentAccountCache(branchId, accountId);
        this.socketService.emitToBranch(branchId, RealtimeEvents.paymentAccounts.update, savedAccount);
        return savedAccount;
    }

    async deleteAccount(branchId: string, accountId: string) {
        const shopId = await this.getShopIdForBranch(branchId);
        const account = await this.model.findOne(shopId, accountId, branchId);
        if (!account) throw AppError.notFound("Payment account");

        if (account.is_active) {
            throw AppError.conflict("Cannot delete the active account. Please activate another account first.");
        }

        let result: ShopPaymentAccount;
        try {
            result = await this.model.delete(account);
        } catch (error) {
            this.throwPersistenceError(error, "Failed to delete payment account.");
        }

        this.invalidatePaymentAccountCache(branchId, accountId);
        this.socketService.emitToBranch(branchId, RealtimeEvents.paymentAccounts.delete, { id: accountId });
        return result;
    }

    // Helper to sync active account to ShopProfile for backward compatibility
    private async syncToShopProfile(shopId: string, account: ShopPaymentAccount) {
        await getRepository(ShopProfile).update(shopId, {
            promptpay_number: account.account_number,
            promptpay_name: account.account_name,
            bank_name: account.bank_name,
            address: account.address,
            phone: account.phone,
            account_type: account.account_type
        });
    }

    async getDeterministicShopId(): Promise<string | undefined> {
        // Always pick the first shop in alphabetic or creation order to be deterministic
        const shops = await getRepository(ShopProfile).find({
            order: { id: "ASC" },
            take: 1
        });
        return shops[0]?.id;
    }
}
