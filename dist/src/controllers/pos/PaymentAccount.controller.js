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
exports.PaymentAccountController = void 0;
const PaymentAccount_service_1 = require("../../services/pos/PaymentAccount.service");
const PaymentAccount_model_1 = require("../../models/pos/PaymentAccount.model");
class PaymentAccountController {
    constructor() {
        this.service = new PaymentAccount_service_1.PaymentAccountService(new PaymentAccount_model_1.PaymentAccountModel());
    }
    getAccounts(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const shopId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.shop_id) || req.query.shopId || (yield this.service.getDeterministicShopId());
                if (!shopId)
                    return res.status(404).json({ message: "Shop not found" });
                const accounts = yield this.service.getAccounts(shopId);
                res.status(200).json(accounts);
            }
            catch (error) {
                res.status(500).json({ message: error.message });
            }
        });
    }
    createAccount(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const shopId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.shop_id) || req.query.shopId || (yield this.service.getDeterministicShopId());
                if (!shopId)
                    return res.status(404).json({ message: "Shop not found" });
                const account = yield this.service.createAccount(shopId, req.body);
                res.status(201).json(account);
            }
            catch (error) {
                res.status(400).json({ message: error.message });
            }
        });
    }
    updateAccount(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const shopId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.shop_id) || req.query.shopId || (yield this.service.getDeterministicShopId());
                if (!shopId)
                    return res.status(404).json({ message: "Shop not found" });
                const { id } = req.params;
                const account = yield this.service.updateAccount(shopId, id, req.body);
                res.status(200).json(account);
            }
            catch (error) {
                res.status(400).json({ message: error.message });
            }
        });
    }
    activateAccount(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const shopId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.shop_id) || req.query.shopId || (yield this.service.getDeterministicShopId());
                if (!shopId)
                    return res.status(404).json({ message: "Shop not found" });
                const { id } = req.params;
                const account = yield this.service.activateAccount(shopId, id);
                res.status(200).json(account);
            }
            catch (error) {
                res.status(400).json({ message: error.message });
            }
        });
    }
    deleteAccount(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const shopId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.shop_id) || req.query.shopId || (yield this.service.getDeterministicShopId());
                if (!shopId)
                    return res.status(404).json({ message: "Shop not found" });
                const { id } = req.params;
                yield this.service.deleteAccount(shopId, id);
                res.status(200).json({ message: "Account deleted successfully" });
            }
            catch (error) {
                res.status(400).json({ message: error.message });
            }
        });
    }
}
exports.PaymentAccountController = PaymentAccountController;
