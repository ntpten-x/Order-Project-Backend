import { Router } from "express";
import { OrdersDetailController } from "../controllers/ordersDetail.controller";

const router = Router();
const ordersDetailController = new OrdersDetailController();

router.post("/update", ordersDetailController.updatePurchase);

export default router;
