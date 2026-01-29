import { Repository } from "typeorm"
import { AppDataSource } from "../../database/database"
import { ShopProfile } from "../../entity/pos/ShopProfile"
import { paymentAccountSchema, CreatePaymentAccountDto } from "../../schemas/paymentAccount.schema"
import { PaymentAccountModel } from "../../models/pos/PaymentAccount.model"
import { ShopPaymentAccount } from "../../entity/pos/ShopPaymentAccount"


export class PaymentAccountService {
    private model: PaymentAccountModel
    private shopRepository: Repository<ShopProfile>

    constructor(model: PaymentAccountModel) {
        this.model = model
        this.shopRepository = AppDataSource.getRepository(ShopProfile)
    }

    async getAccounts(shopId: string) {
        return await this.model.findByShopId(shopId)
    }

    async createAccount(shopId: string, data: CreatePaymentAccountDto) {
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

        return account;
    }

    async updateAccount(shopId: string, accountId: string, data: Partial<CreatePaymentAccountDto>) {
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

        return savedAccount;
    }

    async activateAccount(shopId: string, accountId: string) {
        const account = await this.model.findOne(shopId, accountId);
        if (!account) throw new Error("Account not found");

        // Deactivate all
        await this.model.deactivateAll(shopId);

        // Activate target
        account.is_active = true;
        const savedAccount = await this.model.save(account);

        // Sync with ShopProfile
        await this.syncToShopProfile(shopId, savedAccount);

        return savedAccount;
    }

    async deleteAccount(shopId: string, accountId: string) {
        const account = await this.model.findOne(shopId, accountId);
        if (!account) throw new Error("Account not found");

        if (account.is_active) {
            throw new Error("Cannot delete the active account. Please activate another account first.");
        }

        return await this.model.delete(account);
    }

    // Helper to sync active account to ShopProfile for backward compatibility
    private async syncToShopProfile(shopId: string, account: ShopPaymentAccount) {
        await this.shopRepository.update(shopId, {
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
        const shops = await this.shopRepository.find({
            order: { id: "ASC" },
            take: 1
        });
        return shops[0]?.id;
    }
}
