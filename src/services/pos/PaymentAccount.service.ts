import { ShopProfile } from "../../entity/pos/ShopProfile"
import { paymentAccountSchema, CreatePaymentAccountDto } from "../../schemas/paymentAccount.schema"
import { PaymentAccountModel } from "../../models/pos/PaymentAccount.model"
import { ShopPaymentAccount } from "../../entity/pos/ShopPaymentAccount"
import { SocketService } from "../socket.service"
import { getRepository } from "../../database/dbContext"
import { RealtimeEvents } from "../../utils/realtimeEvents"


export class PaymentAccountService {
    private model: PaymentAccountModel
    private socketService = SocketService.getInstance()

    constructor(model: PaymentAccountModel) {
        this.model = model
    }

    private async getShopIdForBranch(branchId: string): Promise<string> {
        const shopRepository = getRepository(ShopProfile)
        const existing = await shopRepository.findOne({ where: { branch_id: branchId } as any });
        if (existing) return existing.id;

        const created = await shopRepository.save({ branch_id: branchId, shop_name: "POS Shop" } as any);
        return created.id;
    }

    async getAccounts(branchId: string) {
        const shopId = await this.getShopIdForBranch(branchId);
        return await this.model.findByShopId(shopId)
    }

    async createAccount(branchId: string, data: CreatePaymentAccountDto) {
        const shopId = await this.getShopIdForBranch(branchId);
        // Zod Validation
        const validation = paymentAccountSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.issues[0].message);
        }

        // Check for duplicate account number in this shop
        const existing = await this.model.findByAccountNumber(shopId, data.account_number);

        if (existing) {
            throw new Error("This account number already exists in your shop.");
        }

        const accountData: Partial<ShopPaymentAccount> = {
            shop_id: shopId,
            ...data
        };

        // If this is the first account, make it active
        const count = await this.model.count(shopId);
        if (count === 0) {
            accountData.is_active = true;
        }

        // If newly created is set to active, deactivate others
        if (accountData.is_active) {
            await this.model.deactivateAll(shopId);
        }

        const account = await this.model.create(accountData);

        if (account.is_active) {
            // Sync with ShopProfile
            await this.syncToShopProfile(shopId, account);
        }

        this.socketService.emitToBranch(branchId, RealtimeEvents.paymentAccounts.create, account);
        return account;
    }

    async updateAccount(branchId: string, accountId: string, data: Partial<CreatePaymentAccountDto>) {
        const shopId = await this.getShopIdForBranch(branchId);
        const account = await this.model.findOne(shopId, accountId);
        if (!account) throw new Error("Account not found");

        if (data.account_number) {
            // Validate format
            const validation = paymentAccountSchema.pick({ account_number: true }).safeParse({ account_number: data.account_number });
            if (!validation.success) {
                throw new Error(validation.error.issues[0].message);
            }
            // Check duplicates if changing number
            if (data.account_number !== account.account_number) {
                const existing = await this.model.findByAccountNumber(shopId, data.account_number);
                if (existing) throw new Error("This account number already exists.");
            }
        }

        Object.assign(account, data);

        if (account.is_active) {
            await this.model.deactivateAll(shopId);
            // Ensure it's true after bulk update (though object assignment handles it locally, model needs to save)
            account.is_active = true;
        }

        const savedAccount = await this.model.save(account);

        if (savedAccount.is_active) {
            await this.syncToShopProfile(shopId, savedAccount);
        }

        this.socketService.emitToBranch(branchId, RealtimeEvents.paymentAccounts.update, savedAccount);
        return savedAccount;
    }

    async activateAccount(branchId: string, accountId: string) {
        const shopId = await this.getShopIdForBranch(branchId);
        const account = await this.model.findOne(shopId, accountId);
        if (!account) throw new Error("Account not found");

        // Deactivate all
        await this.model.deactivateAll(shopId);

        // Activate target
        account.is_active = true;
        const savedAccount = await this.model.save(account);

        // Sync with ShopProfile
        await this.syncToShopProfile(shopId, savedAccount);

        this.socketService.emitToBranch(branchId, RealtimeEvents.paymentAccounts.update, savedAccount);
        return savedAccount;
    }

    async deleteAccount(branchId: string, accountId: string) {
        const shopId = await this.getShopIdForBranch(branchId);
        const account = await this.model.findOne(shopId, accountId);
        if (!account) throw new Error("Account not found");

        if (account.is_active) {
            throw new Error("Cannot delete the active account. Please activate another account first.");
        }

        const result = await this.model.delete(account);
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
