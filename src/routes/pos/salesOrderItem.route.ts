import { Router } from "express";
import { SalesOrderItemModels } from "../../models/pos/salesOrderItem.model";
import { SalesOrderItemService } from "../../services/pos/salesOrderItem.service";
import { SalesOrderItemController } from "../../controllers/pos/salesOrderItem.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router()

const salesOrderItemModel = new SalesOrderItemModels()
const salesOrderItemService = new SalesOrderItemService(salesOrderItemModel)
const salesOrderItemController = new SalesOrderItemController(salesOrderItemService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), salesOrderItemController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), salesOrderItemController.findOne)

router.post("/", authorizeRole(["Admin", "Manager", "Employee"]), salesOrderItemController.create)
router.put("/:id", authorizeRole(["Admin", "Manager", "Employee"]), salesOrderItemController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), salesOrderItemController.delete)

export default router
