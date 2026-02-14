import { Router } from "express";
import { OrdersController } from "../../controllers/stock/orders.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validate.middleware";
import { paginationQuerySchema } from "../../utils/schemas/common.schema";
import {
    confirmPurchaseSchema,
    createStockOrderSchema,
    stockOrderIdParamSchema,
    updateStockOrderSchema,
    updateStockOrderStatusSchema
} from "../../utils/schemas/stock.schema";

const router = Router();
const ordersController = new OrdersController();

// Protect all routes
router.use(authenticateToken)
router.use(requireBranch)

router.post("/", authorizePermission("stock.orders.page", "create"), validate(createStockOrderSchema), ordersController.createOrder);
router.get("/", authorizePermission("stock.orders.page", "view"), validate(paginationQuerySchema), ordersController.getAllOrders);
router.get("/:id", authorizePermission("stock.orders.page", "view"), validate(stockOrderIdParamSchema), ordersController.getOrderById);
router.put("/:id/status", authorizePermission("stock.orders.page", "update"), validate(updateStockOrderStatusSchema), ordersController.updateStatus);
router.put("/:id", authorizePermission("stock.orders.page", "update"), validate(updateStockOrderSchema), ordersController.updateOrder);

// Restricted routes
router.post("/:id/purchase", authorizePermission("stock.orders.page", "update"), validate(confirmPurchaseSchema), ordersController.confirmPurchase);
router.delete("/:id", authorizePermission("stock.orders.page", "delete"), validate(stockOrderIdParamSchema), ordersController.deleteOrder);

export default router;
