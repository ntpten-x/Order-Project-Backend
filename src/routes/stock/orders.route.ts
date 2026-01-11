import { Router } from "express";
import { OrdersController } from "../../controllers/stock/orders.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router();
const ordersController = new OrdersController();

// Protect all routes
router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))

router.post("/", ordersController.createOrder);
router.get("/", ordersController.getAllOrders);
router.get("/:id", ordersController.getOrderById);
router.put("/:id/status", ordersController.updateStatus);
router.put("/:id", ordersController.updateOrder);

// Restricted routes
router.post("/:id/purchase", authorizeRole(["Admin", "Manager"]), ordersController.confirmPurchase);
router.delete("/:id", authorizeRole(["Admin"]), ordersController.deleteOrder);

export default router;
