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
exports.PaymentsModels = void 0;
const Payments_1 = require("../../entity/pos/Payments");
const dbContext_1 = require("../../database/dbContext");
class PaymentsModels {
    findAll(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const paymentsRepository = (0, dbContext_1.getRepository)(Payments_1.Payments);
                const query = paymentsRepository.createQueryBuilder("payments")
                    .leftJoinAndSelect("payments.order", "order")
                    .leftJoinAndSelect("payments.payment_method", "payment_method")
                    .orderBy("payments.payment_date", "DESC");
                if (branchId) {
                    query.andWhere("payments.branch_id = :branchId", { branchId });
                }
                return query.getMany();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const paymentsRepository = (0, dbContext_1.getRepository)(Payments_1.Payments);
                const query = paymentsRepository.createQueryBuilder("payments")
                    .leftJoinAndSelect("payments.order", "order")
                    .leftJoinAndSelect("payments.payment_method", "payment_method")
                    .where("payments.id = :id", { id });
                if (branchId) {
                    query.andWhere("payments.branch_id = :branchId", { branchId });
                }
                return query.getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = manager ? manager.getRepository(Payments_1.Payments) : (0, dbContext_1.getRepository)(Payments_1.Payments);
                return repo.save(data);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = manager ? manager.getRepository(Payments_1.Payments) : (0, dbContext_1.getRepository)(Payments_1.Payments);
                yield repo.update(id, data);
                // Note: findOne typically relies on default repo. In transaction, we might want to query using manager.
                // But reuse findOne here is okay if we are careful or if strict read consistency isn't violated.
                // To be safe inside transaction, create locally:
                const updatedPayment = yield repo.findOne({
                    where: { id },
                    relations: ["order", "payment_method"]
                });
                if (!updatedPayment) {
                    throw new Error("ไม่พบข้อมูลการชำระเงินที่ต้องการค้นหา");
                }
                return updatedPayment;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = manager ? manager.getRepository(Payments_1.Payments) : (0, dbContext_1.getRepository)(Payments_1.Payments);
                yield repo.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.PaymentsModels = PaymentsModels;
