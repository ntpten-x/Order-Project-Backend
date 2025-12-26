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
exports.OrdersDetailController = void 0;
const ordersDetail_service_1 = require("../services/ordersDetail.service");
const ordersDetail_model_1 = require("../models/ordersDetail.model");
class OrdersDetailController {
    constructor() {
        this.ordersDetailModel = new ordersDetail_model_1.OrdersDetailModel();
        this.ordersDetailService = new ordersDetail_service_1.OrdersDetailService(this.ordersDetailModel);
        this.updatePurchase = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { orders_item_id, actual_quantity, purchased_by_id, is_purchased } = req.body;
                if (!orders_item_id || !purchased_by_id) {
                    return res.status(400).json({ message: "ไม่พบข้อมูลสินค้า" });
                }
                const result = yield this.ordersDetailService.updatePurchaseDetail(orders_item_id, {
                    actual_quantity,
                    purchased_by_id,
                    is_purchased: is_purchased !== null && is_purchased !== void 0 ? is_purchased : true // Default to true if not sent, assuming calling this API means ticking
                });
                return res.status(200).json(result);
            }
            catch (error) {
                console.error("เกิดข้อผิดพลาดในการยืนยันการสั่งซื้อ:", error);
                return res.status(500).json({ message: "เกิดข้อผิดพลาดในการยืนยันการสั่งซื้อ", error: error.message });
            }
        });
    }
}
exports.OrdersDetailController = OrdersDetailController;
