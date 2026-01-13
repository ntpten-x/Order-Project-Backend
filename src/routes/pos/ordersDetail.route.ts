import { Router } from "express";
import { OrdersDetailModels } from "../../models/pos/ordersDetail.model";
import { OrdersDetailService } from "../../services/pos/ordersDetail.service";
import { OrdersDetailController } from "../../controllers/pos/ordersDetail.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router()

const ordersDetailModel = new OrdersDetailModels()
const ordersDetailService = new OrdersDetailService(ordersDetailModel)
const ordersDetailController = new OrdersDetailController(ordersDetailService)

router.use(authenticateToken)

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), ordersDetailController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), ordersDetailController.findOne)

router.post("/", authorizeRole(["Admin", "Manager", "Employee"]), ordersDetailController.create)
router.put("/:id", authorizeRole(["Admin", "Manager", "Employee"]), ordersDetailController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), ordersDetailController.delete)

export default router
