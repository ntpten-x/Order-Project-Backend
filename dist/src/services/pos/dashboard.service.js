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
const database_1 = require("../../database/database");
const SalesSummaryView_1 = require("../../entity/pos/views/SalesSummaryView");
const TopSellingItemsView_1 = require("../../entity/pos/views/TopSellingItemsView");
class DashboardService {
    constructor() {
        this.salesRepository = database_1.AppDataSource.getRepository(SalesSummaryView_1.SalesSummaryView);
        this.topItemsRepository = database_1.AppDataSource.getRepository(TopSellingItemsView_1.TopSellingItemsView);
    }
    getSalesSummary(startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = this.salesRepository.createQueryBuilder("sales");
            if (startDate && endDate) {
                query.where("sales.date BETWEEN :startDate AND :endDate", { startDate, endDate });
            }
            query.orderBy("sales.date", "DESC");
            return yield query.getMany();
        });
    }
    getTopSellingItems() {
        return __awaiter(this, arguments, void 0, function* (limit = 10) {
            return yield this.topItemsRepository.find({
                order: {
                    total_quantity: "DESC"
                },
                take: limit
            });
        });
    }
}
exports.DashboardService = DashboardService;
