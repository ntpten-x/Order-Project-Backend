import { Router } from "express";
import { OrdersController } from "../../controllers/stock/orders.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
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
router.use(authorizeRole(["Admin", "Manager"]))
router.use(requireBranch)

router.post("/", validate(createStockOrderSchema), ordersController.createOrder);
router.get("/", validate(paginationQuerySchema), ordersController.getAllOrders);
router.get("/:id", validate(stockOrderIdParamSchema), ordersController.getOrderById);
router.put("/:id/status", validate(updateStockOrderStatusSchema), ordersController.updateStatus);
router.put("/:id", validate(updateStockOrderSchema), ordersController.updateOrder);

// Restricted routes
router.post("/:id/purchase", authorizeRole(["Admin", "Manager"]), validate(confirmPurchaseSchema), ordersController.confirmPurchase);
router.delete("/:id", authorizeRole(["Admin"]), validate(stockOrderIdParamSchema), ordersController.deleteOrder);

export default router;
