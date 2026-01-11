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
exports.OrdersDetailModel = void 0;
const database_1 = require("../../database/database");
const OrdersDetail_1 = require("../../entity/stock/OrdersDetail");
const OrdersItem_1 = require("../../entity/stock/OrdersItem");
class OrdersDetailModel {
    constructor() {
        this.ordersDetailRepository = database_1.AppDataSource.getRepository(OrdersDetail_1.OrdersDetail);
        this.ordersItemRepository = database_1.AppDataSource.getRepository(OrdersItem_1.OrdersItem);
    }
    findByOrderItemId(ordersItemId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.ordersDetailRepository.findOneBy({ orders_item_id: ordersItemId });
        });
    }
    createOrUpdate(ordersItemId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            let detail = yield this.ordersDetailRepository.findOneBy({ orders_item_id: ordersItemId });
            if (!detail) {
                detail = this.ordersDetailRepository.create(Object.assign({ orders_item_id: ordersItemId }, data));
            }
            else {
                detail.actual_quantity = data.actual_quantity;
                detail.purchased_by_id = data.purchased_by_id;
                detail.is_purchased = data.is_purchased;
            }
            return yield this.ordersDetailRepository.save(detail);
        });
    }
    getOrderItemWithOrder(ordersItemId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.ordersItemRepository.findOne({
                where: { id: ordersItemId },
                relations: { orders: true }
            });
        });
    }
}
exports.OrdersDetailModel = OrdersDetailModel;
