"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orders_controller_1 = require("../../controllers/stock/orders.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
const ordersController = new orders_controller_1.OrdersController();
// Protect all routes
router.use(auth_middleware_1.authenticateToken);
router.use((0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]));
router.post("/", ordersController.createOrder);
router.get("/", ordersController.getAllOrders);
router.get("/:id", ordersController.getOrderById);
router.put("/:id/status", ordersController.updateStatus);
router.put("/:id", ordersController.updateOrder);
// Restricted routes
router.post("/:id/purchase", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), ordersController.confirmPurchase);
router.delete("/:id", (0, auth_middleware_1.authorizeRole)(["Admin"]), ordersController.deleteOrder);
exports.default = router;
