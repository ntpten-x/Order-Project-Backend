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
const PaymentMethod_1 = require("../../entity/pos/PaymentMethod");
const dbContext_1 = require("../../database/dbContext");
class PaymentMethodModels {
    findAll() {
        return __awaiter(this, arguments, void 0, function* (page = 1, limit = 50, q, branchId) {
            try {
                const skip = (page - 1) * limit;
                const paymentMethodRepository = (0, dbContext_1.getRepository)(PaymentMethod_1.PaymentMethod);
                const query = paymentMethodRepository.createQueryBuilder("paymentMethod")
                    .orderBy("paymentMethod.create_date", "ASC");
                if (branchId) {
                    query.andWhere("paymentMethod.branch_id = :branchId", { branchId });
                }
                if (q && q.trim()) {
                    query.andWhere("(paymentMethod.payment_method_name ILIKE :q OR paymentMethod.display_name ILIKE :q)", { q: `%${q.trim()}%` });
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
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const paymentMethodRepository = (0, dbContext_1.getRepository)(PaymentMethod_1.PaymentMethod);
                const where = { id };
                if (branchId) {
                    where.branch_id = branchId;
                }
                return paymentMethodRepository.findOneBy(where);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(payment_method_name, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const paymentMethodRepository = (0, dbContext_1.getRepository)(PaymentMethod_1.PaymentMethod);
                const where = { payment_method_name };
                if (branchId) {
                    where.branch_id = branchId;
                }
                return paymentMethodRepository.findOneBy(where);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return (0, dbContext_1.getRepository)(PaymentMethod_1.PaymentMethod).save(data);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const paymentMethodRepository = (0, dbContext_1.getRepository)(PaymentMethod_1.PaymentMethod);
                if (branchId) {
                    yield paymentMethodRepository.update({ id, branch_id: branchId }, data);
                }
                else {
                    yield paymentMethodRepository.update(id, data);
                }
                const updatedPaymentMethod = yield this.findOne(id, branchId);
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
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const paymentMethodRepository = (0, dbContext_1.getRepository)(PaymentMethod_1.PaymentMethod);
                if (branchId) {
                    yield paymentMethodRepository.delete({ id, branch_id: branchId });
                }
                else {
                    yield paymentMethodRepository.delete(id);
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.PaymentMethodModels = PaymentMethodModels;
