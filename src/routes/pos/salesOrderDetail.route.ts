import { Router } from "express";
import { SalesOrderDetailModels } from "../../models/pos/salesOrderDetail.model";
import { SalesOrderDetailService } from "../../services/pos/salesOrderDetail.service";
import { SalesOrderDetailController } from "../../controllers/pos/salesOrderDetail.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router()

const salesOrderDetailModel = new SalesOrderDetailModels()
const salesOrderDetailService = new SalesOrderDetailService(salesOrderDetailModel)
const salesOrderDetailController = new SalesOrderDetailController(salesOrderDetailService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), salesOrderDetailController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), salesOrderDetailController.findOne)

router.post("/", authorizeRole(["Admin", "Manager", "Employee"]), salesOrderDetailController.create)
router.put("/:id", authorizeRole(["Admin", "Manager", "Employee"]), salesOrderDetailController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), salesOrderDetailController.delete)

export default router
