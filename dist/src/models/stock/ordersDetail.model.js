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
exports.StockOrdersDetailModel = void 0;
const OrdersDetail_1 = require("../../entity/stock/OrdersDetail");
const OrdersItem_1 = require("../../entity/stock/OrdersItem");
const dbContext_1 = require("../../database/dbContext");
class StockOrdersDetailModel {
    findByOrderItemId(ordersItemId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, dbContext_1.getRepository)(OrdersDetail_1.StockOrdersDetail).findOneBy({ orders_item_id: ordersItemId });
        });
    }
    createOrUpdate(ordersItemId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const ordersDetailRepository = (0, dbContext_1.getRepository)(OrdersDetail_1.StockOrdersDetail);
            let detail = yield ordersDetailRepository.findOneBy({ orders_item_id: ordersItemId });
            if (!detail) {
                detail = ordersDetailRepository.create(Object.assign({ orders_item_id: ordersItemId }, data));
            }
            else {
                detail.actual_quantity = data.actual_quantity;
                detail.purchased_by_id = data.purchased_by_id;
                detail.is_purchased = data.is_purchased;
            }
            return yield ordersDetailRepository.save(detail);
        });
    }
    getOrderItemWithOrder(ordersItemId, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const ordersItemRepository = (0, dbContext_1.getRepository)(OrdersItem_1.StockOrdersItem);
            const query = ordersItemRepository
                .createQueryBuilder("item")
                .leftJoinAndSelect("item.orders", "orders")
                .where("item.id = :id", { id: ordersItemId });
            if (branchId) {
                query.andWhere("orders.branch_id = :branchId", { branchId });
            }
            return query.getOne();
        });
    }
}
exports.StockOrdersDetailModel = StockOrdersDetailModel;
