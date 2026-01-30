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
        return __awaiter(this, arguments, void 0, function* (page = 1, limit = 50, q) {
            try {
                const skip = (page - 1) * limit;
                const query = this.paymentMethodRepository.createQueryBuilder("paymentMethod")
                    .orderBy("paymentMethod.create_date", "ASC");
                if (q && q.trim()) {
                    query.where("(paymentMethod.payment_method_name ILIKE :q OR paymentMethod.display_name ILIKE :q)", { q: `%${q.trim()}%` });
                }
                const [data, total] = yield query.skip(skip).take(limit).getManyAndCount();
                return {
                    data,
                    total,
                    page,
                    last_page: Math.max(1, Math.ceil(total / limit))
                };
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
