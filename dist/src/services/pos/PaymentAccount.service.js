"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentAccountService = void 0;
const database_1 = require("../../database/database");
const ShopProfile_1 = require("../../entity/pos/ShopProfile");
const paymentAccount_schema_1 = require("../../schemas/paymentAccount.schema");
const socket_service_1 = require("../socket.service");
class PaymentAccountService {
    constructor(model) {
        this.socketService = socket_service_1.SocketService.getInstance();
        this.model = model;
        this.shopRepository = database_1.AppDataSource.getRepository(ShopProfile_1.ShopProfile);
    }
    getAccounts(shopId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.model.findByShopId(shopId);
        });
    }
    createAccount(shopId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Zod Validation
            const validation = paymentAccount_schema_1.paymentAccountSchema.safeParse(data);
            if (!validation.success) {
                throw new Error(validation.error.issues[0].message);
            }
            // Check for duplicate account number in this shop
            const existing = yield this.model.findByAccountNumber(shopId, data.account_number);
            if (existing) {
                throw new Error("This account number already exists in your shop.");
            }
            const accountData = Object.assign({ shop_id: shopId }, data);
            // If this is the first account, make it active
            const count = yield this.model.count(shopId);
            if (count === 0) {
                accountData.is_active = true;
            }
            // If newly created is set to active, deactivate others
            if (accountData.is_active) {
                yield this.model.deactivateAll(shopId);
            }
            const account = yield this.model.create(accountData);
            if (account.is_active) {
                // Sync with ShopProfile
                yield this.syncToShopProfile(shopId, account);
            }
            this.socketService.emit("payment-accounts:create", account);
            return account;
        });
    }
    updateAccount(shopId, accountId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const account = yield this.model.findOne(shopId, accountId);
            if (!account)
                throw new Error("Account not found");
            if (data.account_number) {
                // Validate format
                const validation = paymentAccount_schema_1.paymentAccountSchema.pick({ account_number: true }).safeParse({ account_number: data.account_number });
                if (!validation.success) {
                    throw new Error(validation.error.issues[0].message);
                }
                // Check duplicates if changing number
                if (data.account_number !== account.account_number) {
                    const existing = yield this.model.findByAccountNumber(shopId, data.account_number);
                    if (existing)
                        throw new Error("This account number already exists.");
                }
            }
            Object.assign(account, data);
            if (account.is_active) {
                yield this.model.deactivateAll(shopId);
                // Ensure it's true after bulk update (though object assignment handles it locally, model needs to save)
                account.is_active = true;
            }
            const savedAccount = yield this.model.save(account);
            if (savedAccount.is_active) {
                yield this.syncToShopProfile(shopId, savedAccount);
            }
            this.socketService.emit("payment-accounts:update", savedAccount);
            return savedAccount;
        });
    }
    activateAccount(shopId, accountId) {
        return __awaiter(this, void 0, void 0, function* () {
            const account = yield this.model.findOne(shopId, accountId);
            if (!account)
                throw new Error("Account not found");
            // Deactivate all
            yield this.model.deactivateAll(shopId);
            // Activate target
            account.is_active = true;
            const savedAccount = yield this.model.save(account);
            // Sync with ShopProfile
            yield this.syncToShopProfile(shopId, savedAccount);
            this.socketService.emit("payment-accounts:update", savedAccount);
            return savedAccount;
        });
    }
    deleteAccount(shopId, accountId) {
        return __awaiter(this, void 0, void 0, function* () {
            const account = yield this.model.findOne(shopId, accountId);
            if (!account)
                throw new Error("Account not found");
            if (account.is_active) {
                throw new Error("Cannot delete the active account. Please activate another account first.");
            }
            const result = yield this.model.delete(account);
            this.socketService.emit("payment-accounts:delete", { id: accountId });
            return result;
        });
    }
    // Helper to sync active account to ShopProfile for backward compatibility
    syncToShopProfile(shopId, account) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.shopRepository.update(shopId, {
                promptpay_number: account.account_number,
                promptpay_name: account.account_name,
                bank_name: account.bank_name,
                address: account.address,
                phone: account.phone,
                account_type: account.account_type
            });
        });
    }
    getDeterministicShopId() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Always pick the first shop in alphabetic or creation order to be deterministic
            const shops = yield this.shopRepository.find({
                order: { id: "ASC" },
                take: 1
            });
            return (_a = shops[0]) === null || _a === void 0 ? void 0 : _a.id;
        });
    }
}
exports.PaymentAccountService = PaymentAccountService;
