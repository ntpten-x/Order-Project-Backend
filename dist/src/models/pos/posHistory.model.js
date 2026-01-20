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
exports.PosHistoryModel = void 0;
const database_1 = require("../../database/database");
const PosHistory_1 = require("../../entity/pos/PosHistory");
class PosHistoryModel {
    constructor() {
        this.posHistoryRepository = database_1.AppDataSource.getRepository(PosHistory_1.PosHistory);
    }
    findAll() {
        return __awaiter(this, arguments, void 0, function* (page = 1, limit = 50) {
            try {
                const skip = (page - 1) * limit;
                const [data, total] = yield this.posHistoryRepository.findAndCount({
                    order: {
                        create_date: "DESC"
                    },
                    take: limit,
                    skip: skip
                });
                return {
                    data,
                    total,
                    page,
                    limit
                };
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.posHistoryRepository.findOne({
                where: { id }
            });
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.posHistoryRepository.save(data);
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.posHistoryRepository.update(id, data);
            const updated = yield this.findOne(id);
            if (!updated) {
                throw new Error("ไม่พบข้อมูลประวัติที่ต้องการแก้ไข");
            }
            return updated;
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.posHistoryRepository.delete(id);
        });
    }
}
exports.PosHistoryModel = PosHistoryModel;
