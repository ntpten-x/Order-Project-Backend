import { Router } from "express";
import { OrdersController } from "../controllers/orders.controller";
import { authenticateToken, authorizeRole } from "../middleware/auth.middleware";

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
router.post("/:id/purchase", ordersController.confirmPurchase);
router.delete("/:id", ordersController.deleteOrder);

export default router;
