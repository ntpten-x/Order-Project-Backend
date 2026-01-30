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
exports.DiscountsModels = void 0;
const database_1 = require("../../database/database");
const Discounts_1 = require("../../entity/pos/Discounts");
class DiscountsModels {
    constructor() {
        this.discountsRepository = database_1.AppDataSource.getRepository(Discounts_1.Discounts);
    }
    findAll(q) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = this.discountsRepository.createQueryBuilder("discounts")
                    .orderBy("discounts.create_date", "ASC");
                if (q && q.trim()) {
                    query.where("(discounts.discount_name ILIKE :q OR discounts.display_name ILIKE :q OR discounts.description ILIKE :q)", { q: `%${q.trim()}%` });
                }
                return query.getMany();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.discountsRepository.findOneBy({ id });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(discount_name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.discountsRepository.findOneBy({ discount_name });
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.discountsRepository.save(data);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.discountsRepository.update(id, data);
                const updatedDiscount = yield this.findOne(id);
                if (!updatedDiscount) {
                    throw new Error("ไม่พบข้อมูลส่วนลดที่ต้องการค้นหา");
                }
                return updatedDiscount;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.discountsRepository.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.DiscountsModels = DiscountsModels;
