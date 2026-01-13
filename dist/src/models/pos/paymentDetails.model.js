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
exports.PaymentDetailsModels = void 0;
const database_1 = require("../../database/database");
const PaymentDetails_1 = require("../../entity/pos/PaymentDetails");
class PaymentDetailsModels {
    constructor() {
        this.paymentDetailsRepository = database_1.AppDataSource.getRepository(PaymentDetails_1.PaymentDetails);
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentDetailsRepository.find({
                    order: {
                        create_date: "ASC"
                    },
                    relations: ["payment"]
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
                return this.paymentDetailsRepository.findOne({
                    where: { id },
                    relations: ["payment"]
                });
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentDetailsRepository.save(data);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.paymentDetailsRepository.update(id, data);
                const updatedDetail = yield this.findOne(id);
                if (!updatedDetail) {
                    throw new Error("ไม่พบข้อมูลรายละเอียดการชำระเงินที่ต้องการค้นหา");
                }
                return updatedDetail;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.paymentDetailsRepository.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.PaymentDetailsModels = PaymentDetailsModels;
