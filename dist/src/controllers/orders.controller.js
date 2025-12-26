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
exports.OrdersController = void 0;
const orders_service_1 = require("../services/orders.service");
const Orders_1 = require("../entity/Orders");
const orders_model_1 = require("../models/orders.model");
class OrdersController {
    constructor() {
        this.ordersModel = new orders_model_1.OrdersModel();
        this.ordersService = new orders_service_1.OrdersService(this.ordersModel);
        this.createOrder = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { ordered_by_id, items, remark } = req.body;
                // Validate input
                if (!ordered_by_id || !items || !Array.isArray(items) || items.length === 0) {
                    return res.status(400).json({ message: "ไม่พบข้อมูลการสั่งซื้อ" });
                }
                const order = yield this.ordersService.createOrder(ordered_by_id, items, remark);
                return res.status(201).json(order);
            }
            catch (error) {
                console.error("Error creating order:", error);
                return res.status(500).json({ message: "Internal server error", error: error.message });
            }
        });
        this.getAllOrders = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const orders = yield this.ordersService.getAllOrders();
                return res.status(200).json(orders);
            }
            catch (error) {
                console.error("Error fetching orders:", error);
                return res.status(500).json({ message: "Internal server error", error: error.message });
            }
        });
        this.getOrderById = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const order = yield this.ordersService.getOrderById(id);
                if (!order) {
                    return res.status(404).json({ message: "ไม่พบข้อมูลการสั่งซื้อ" });
                }
                return res.status(200).json(order);
            }
            catch (error) {
                console.error("Error fetching order:", error);
                return res.status(500).json({ message: "Internal server error", error: error.message });
            }
        });
        this.updateOrder = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { items } = req.body;
                if (!items || !Array.isArray(items)) {
                    return res.status(400).json({ message: "ไม่พบข้อมูลสินค้า" });
                }
                const updatedOrder = yield this.ordersService.updateOrder(id, items);
                return res.status(200).json(updatedOrder);
            }
            catch (error) {
                console.error("Error updating order:", error);
                return res.status(500).json({ message: "Internal server error", error: error.message });
            }
        });
        this.updateStatus = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { status } = req.body;
                if (!Object.values(Orders_1.OrderStatus).includes(status)) {
                    return res.status(400).json({ message: "ไม่พบข้อมูลสถานะ" });
                }
                const updatedOrder = yield this.ordersService.updateStatus(id, status);
                return res.status(200).json(updatedOrder);
            }
            catch (error) {
                console.error("Error updating order status:", error);
                return res.status(500).json({ message: "Internal server error", error: error.message });
            }
        });
        this.deleteOrder = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                yield this.ordersService.deleteOrder(id);
                return res.status(200).json({ message: "การสั่งซื้อลบสำเร็จ" });
            }
            catch (error) {
                console.error("Error deleting order:", error);
                return res.status(500).json({ message: "Internal server error", error: error.message });
            }
        });
        this.confirmPurchase = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                const { items } = req.body;
                // Assuming user id is available in req.user from auth middleware, but for now getting from body or header if not strict
                // Adjust based on your Auth implementation. Providing default or extracting from req if available.
                // Check if req.user exists (from middleware)
                const purchased_by_id = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || req.body.purchased_by_id;
                if (!items || !Array.isArray(items)) {
                    return res.status(400).json({ message: "ไม่พบข้อมูลสินค้า" });
                }
                if (!purchased_by_id) {
                    return res.status(400).json({ message: "ไม่พบข้อมูลผู้สั่งซื้อ" });
                }
                const updatedOrder = yield this.ordersService.confirmPurchase(id, items, purchased_by_id);
                return res.status(200).json(updatedOrder);
            }
            catch (error) {
                console.error("เกิดข้อผิดพลาดในการยืนยันการสั่งซื้อ:", error);
                return res.status(500).json({ message: "เกิดข้อผิดพลาดในการยืนยันการสั่งซื้อ", error: error.message });
            }
        });
    }
}
exports.OrdersController = OrdersController;
