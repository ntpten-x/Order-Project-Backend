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
exports.DeliveryModels = void 0;
const database_1 = require("../../database/database");
const Delivery_1 = require("../../entity/pos/Delivery");
class DeliveryModels {
    constructor() {
        this.deliveryRepository = database_1.AppDataSource.getRepository(Delivery_1.Delivery);
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.deliveryRepository.find({
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
                return this.deliveryRepository.findOneBy({ id });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(delivery_name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.deliveryRepository.findOneBy({ delivery_name });
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.deliveryRepository.save(data);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.deliveryRepository.update(id, data);
                const updatedDelivery = yield this.findOne(id);
                if (!updatedDelivery) {
                    throw new Error("ไม่พบข้อมูลบริการส่งที่ต้องการค้นหา");
                }
                return updatedDelivery;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.deliveryRepository.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.DeliveryModels = DeliveryModels;
