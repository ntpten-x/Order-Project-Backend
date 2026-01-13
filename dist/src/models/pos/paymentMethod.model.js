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
exports.PaymentMethodModels = void 0;
const database_1 = require("../../database/database");
const PaymentMethod_1 = require("../../entity/pos/PaymentMethod");
class PaymentMethodModels {
    constructor() {
        this.paymentMethodRepository = database_1.AppDataSource.getRepository(PaymentMethod_1.PaymentMethod);
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentMethodRepository.find({
                    order: {
                        create_date: "ASC"
                    }
                });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentMethodRepository.findOneBy({ id });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(payment_method_name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentMethodRepository.findOneBy({ payment_method_name });
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentMethodRepository.save(data);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.paymentMethodRepository.update(id, data);
                const updatedPaymentMethod = yield this.findOne(id);
                if (!updatedPaymentMethod) {
                    throw new Error("ไม่พบข้อมูลวิธีการชำระเงินที่ต้องการค้นหา");
                }
                return updatedPaymentMethod;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.paymentMethodRepository.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.PaymentMethodModels = PaymentMethodModels;
