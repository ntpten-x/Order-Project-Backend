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
const Discounts_1 = require("../../entity/pos/Discounts");
const dbContext_1 = require("../../database/dbContext");
class DiscountsModels {
    findAll(q, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const discountsRepository = (0, dbContext_1.getRepository)(Discounts_1.Discounts);
                const query = discountsRepository.createQueryBuilder("discounts")
                    .orderBy("discounts.create_date", "ASC");
                if (branchId) {
                    query.andWhere("discounts.branch_id = :branchId", { branchId });
                }
                if (q && q.trim()) {
                    query.andWhere("(discounts.discount_name ILIKE :q OR discounts.display_name ILIKE :q OR discounts.description ILIKE :q)", { q: `%${q.trim()}%` });
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
                const discountsRepository = (0, dbContext_1.getRepository)(Discounts_1.Discounts);
                const where = { id };
                if (branchId) {
                    where.branch_id = branchId;
                }
                return discountsRepository.findOneBy(where);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(discount_name, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const discountsRepository = (0, dbContext_1.getRepository)(Discounts_1.Discounts);
                const where = { discount_name };
                if (branchId) {
                    where.branch_id = branchId;
                }
                return discountsRepository.findOneBy(where);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return (0, dbContext_1.getRepository)(Discounts_1.Discounts).save(data);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const discountsRepository = (0, dbContext_1.getRepository)(Discounts_1.Discounts);
                if (branchId) {
                    yield discountsRepository.update({ id, branch_id: branchId }, data);
                }
                else {
                    yield discountsRepository.update(id, data);
                }
                const updatedDiscount = yield this.findOne(id, branchId);
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
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const discountsRepository = (0, dbContext_1.getRepository)(Discounts_1.Discounts);
                if (branchId) {
                    yield discountsRepository.delete({ id, branch_id: branchId });
                }
                else {
                    yield discountsRepository.delete(id);
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.DiscountsModels = DiscountsModels;
