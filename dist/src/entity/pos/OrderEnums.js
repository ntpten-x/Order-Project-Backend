"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderStatus = exports.OrderType = void 0;
var OrderType;
(function (OrderType) {
    OrderType["DineIn"] = "DineIn";
    OrderType["TakeAway"] = "TakeAway";
    OrderType["Delivery"] = "Delivery"; // เดลิเวอรี่
})(OrderType || (exports.OrderType = OrderType = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["Pending"] = "Pending";
    OrderStatus["Cooking"] = "Cooking";
    OrderStatus["Served"] = "Served";
    OrderStatus["WaitingForPayment"] = "WaitingForPayment";
    OrderStatus["Paid"] = "Paid";
    OrderStatus["Cancelled"] = "Cancelled";
    // Legacy values for migration
    OrderStatus["pending"] = "pending";
    OrderStatus["completed"] = "completed";
    OrderStatus["cancelled"] = "cancelled";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
