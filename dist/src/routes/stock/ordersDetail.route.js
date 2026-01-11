"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ordersDetail_controller_1 = require("../../controllers/stock/ordersDetail.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
const ordersDetailController = new ordersDetail_controller_1.OrdersDetailController();
// Protect all routes
router.use(auth_middleware_1.authenticateToken);
router.use((0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]));
router.post("/update", ordersDetailController.updatePurchase);
exports.default = router;
