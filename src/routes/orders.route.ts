import { Router } from "express";
import { OrdersController } from "../controllers/orders.controller";

const router = Router();
const ordersController = new OrdersController();

router.post("/", ordersController.createOrder);
router.get("/", ordersController.getAllOrders);
router.get("/:id", ordersController.getOrderById);
router.put("/:id/status", ordersController.updateStatus);
router.put("/:id", ordersController.updateOrder);
router.delete("/:id", ordersController.deleteOrder);

export default router;
