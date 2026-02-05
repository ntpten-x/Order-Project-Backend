import { Router } from "express";
import { OrdersDetailController } from "../../controllers/stock/ordersDetail.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { validate } from "../../middleware/validate.middleware";
import { updateOrdersDetailPurchaseSchema } from "../../utils/schemas/stock.schema";

const router = Router();
const ordersDetailController = new OrdersDetailController();

// Protect all routes
router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager"]))
router.use(requireBranch)

router.post("/update", validate(updateOrdersDetailPurchaseSchema), ordersDetailController.updatePurchase);

export default router;
