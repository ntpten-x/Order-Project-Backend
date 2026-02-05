"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ordersDetail_controller_1 = require("../../controllers/stock/ordersDetail.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const branch_middleware_1 = require("../../middleware/branch.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const stock_schema_1 = require("../../utils/schemas/stock.schema");
const router = (0, express_1.Router)();
const ordersDetailController = new ordersDetail_controller_1.OrdersDetailController();
// Protect all routes
router.use(auth_middleware_1.authenticateToken);
router.use((0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]));
router.use(branch_middleware_1.requireBranch);
router.post("/update", (0, validate_middleware_1.validate)(stock_schema_1.updateOrdersDetailPurchaseSchema), ordersDetailController.updatePurchase);
exports.default = router;
