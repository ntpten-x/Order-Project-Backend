"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orders_controller_1 = require("../../controllers/stock/orders.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const common_schema_1 = require("../../utils/schemas/common.schema");
const stock_schema_1 = require("../../utils/schemas/stock.schema");
const router = (0, express_1.Router)();
const ordersController = new orders_controller_1.OrdersController();
// Protect all routes
router.use(auth_middleware_1.authenticateToken);
router.use((0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]));
router.post("/", (0, validate_middleware_1.validate)(stock_schema_1.createStockOrderSchema), ordersController.createOrder);
router.get("/", (0, validate_middleware_1.validate)(common_schema_1.paginationQuerySchema), ordersController.getAllOrders);
router.get("/:id", (0, validate_middleware_1.validate)(stock_schema_1.stockOrderIdParamSchema), ordersController.getOrderById);
router.put("/:id/status", (0, validate_middleware_1.validate)(stock_schema_1.updateStockOrderStatusSchema), ordersController.updateStatus);
router.put("/:id", (0, validate_middleware_1.validate)(stock_schema_1.updateStockOrderSchema), ordersController.updateOrder);
// Restricted routes
router.post("/:id/purchase", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), (0, validate_middleware_1.validate)(stock_schema_1.confirmPurchaseSchema), ordersController.confirmPurchase);
router.delete("/:id", (0, auth_middleware_1.authorizeRole)(["Admin"]), (0, validate_middleware_1.validate)(stock_schema_1.stockOrderIdParamSchema), ordersController.deleteOrder);
exports.default = router;
