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
exports.PaymentAccountModel = void 0;
const ShopPaymentAccount_1 = require("../../entity/pos/ShopPaymentAccount");
const dbContext_1 = require("../../database/dbContext");
class PaymentAccountModel {
    findByShopId(shopId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, dbContext_1.getRepository)(ShopPaymentAccount_1.ShopPaymentAccount).find({
                where: { shop_id: shopId },
                order: { is_active: "DESC", created_at: "DESC" }
            });
        });
    }
    findOne(shopId, accountId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, dbContext_1.getRepository)(ShopPaymentAccount_1.ShopPaymentAccount).findOne({ where: { id: accountId, shop_id: shopId } });
        });
    }
    findByAccountNumber(shopId, accountNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, dbContext_1.getRepository)(ShopPaymentAccount_1.ShopPaymentAccount).findOne({
                where: { shop_id: shopId, account_number: accountNumber }
            });
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const repository = (0, dbContext_1.getRepository)(ShopPaymentAccount_1.ShopPaymentAccount);
            const account = repository.create(data);
            return yield repository.save(account);
        });
    }
    save(account) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, dbContext_1.getRepository)(ShopPaymentAccount_1.ShopPaymentAccount).save(account);
        });
    }
    deactivateAll(shopId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, dbContext_1.getRepository)(ShopPaymentAccount_1.ShopPaymentAccount).update({ shop_id: shopId }, { is_active: false });
        });
    }
    delete(account) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, dbContext_1.getRepository)(ShopPaymentAccount_1.ShopPaymentAccount).remove(account);
        });
    }
    count(shopId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, dbContext_1.getRepository)(ShopPaymentAccount_1.ShopPaymentAccount).count({ where: { shop_id: shopId } });
        });
    }
}
exports.PaymentAccountModel = PaymentAccountModel;
