import { Router } from "express";
import { OrdersDetailController } from "../../controllers/stock/ordersDetail.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router();
const ordersDetailController = new OrdersDetailController();

// Protect all routes
router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))

router.post("/update", ordersDetailController.updatePurchase);

export default router;
