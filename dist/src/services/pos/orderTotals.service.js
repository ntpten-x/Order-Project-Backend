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
exports.recalculateOrderTotal = void 0;
const SalesOrder_1 = require("../../entity/pos/SalesOrder");
const SalesOrderItem_1 = require("../../entity/pos/SalesOrderItem");
const priceCalculator_service_1 = require("./priceCalculator.service");
const dbContext_1 = require("../../database/dbContext");
const orderStatus_1 = require("../../utils/orderStatus");
const recalculateOrderTotal = (orderId, manager) => __awaiter(void 0, void 0, void 0, function* () {
    const orderRepo = manager ? manager.getRepository(SalesOrder_1.SalesOrder) : (0, dbContext_1.getRepository)(SalesOrder_1.SalesOrder);
    const itemRepo = manager ? manager.getRepository(SalesOrderItem_1.SalesOrderItem) : (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem);
    const order = yield orderRepo.findOne({
        where: { id: orderId },
        relations: ["discount"]
    });
    if (!order)
        return;
    const items = yield itemRepo.find({ where: { order_id: orderId } });
    // Support legacy 'cancelled' values too.
    const validItems = items.filter(i => !(0, orderStatus_1.isCancelledStatus)(i.status));
    const result = priceCalculator_service_1.PriceCalculatorService.calculateOrderTotal(validItems, order.discount);
    yield orderRepo.update(orderId, {
        sub_total: result.subTotal,
        discount_amount: result.discountAmount,
        vat: result.vatAmount,
        total_amount: result.totalAmount
    });
});
exports.recalculateOrderTotal = recalculateOrderTotal;
