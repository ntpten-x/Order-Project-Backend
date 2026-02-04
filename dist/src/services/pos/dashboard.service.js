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
exports.DashboardService = void 0;
const SalesSummaryView_1 = require("../../entity/pos/views/SalesSummaryView");
const TopSellingItemsView_1 = require("../../entity/pos/views/TopSellingItemsView");
const dbContext_1 = require("../../database/dbContext");
class DashboardService {
    getSalesSummary(startDate, endDate, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const salesRepository = (0, dbContext_1.getRepository)(SalesSummaryView_1.SalesSummaryView);
            const query = salesRepository.createQueryBuilder("sales");
            if (startDate && endDate) {
                query.where("sales.date BETWEEN :startDate AND :endDate", { startDate, endDate });
            }
            if (branchId) {
                query.andWhere("sales.branch_id = :branchId", { branchId });
            }
            query.orderBy("sales.date", "DESC");
            return yield query.getMany();
        });
    }
    getTopSellingItems() {
        return __awaiter(this, arguments, void 0, function* (limit = 10, branchId) {
            const topItemsRepository = (0, dbContext_1.getRepository)(TopSellingItemsView_1.TopSellingItemsView);
            return yield topItemsRepository.find({
                where: branchId ? { branch_id: branchId } : undefined,
                order: {
                    total_quantity: "DESC"
                },
                take: limit
            });
        });
    }
}
exports.DashboardService = DashboardService;
