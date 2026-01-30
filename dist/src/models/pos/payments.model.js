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
const database_1 = require("../../database/database");
const Payments_1 = require("../../entity/pos/Payments");
class PaymentsModels {
    constructor() {
        this.paymentsRepository = database_1.AppDataSource.getRepository(Payments_1.Payments);
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentsRepository.find({
                    order: {
                        payment_date: "DESC"
                    },
                    relations: ["order", "payment_method"]
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
                return this.paymentsRepository.findOne({
                    where: { id },
                    relations: ["order", "payment_method"]
                });
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = manager ? manager.getRepository(Payments_1.Payments) : this.paymentsRepository;
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
                const repo = manager ? manager.getRepository(Payments_1.Payments) : this.paymentsRepository;
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
                const repo = manager ? manager.getRepository(Payments_1.Payments) : this.paymentsRepository;
                yield repo.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.PaymentsModels = PaymentsModels;
