import { Router } from "express";
import { SalesOrderItemModels } from "../../models/pos/salesOrderItem.model";
import { SalesOrderItemService } from "../../services/pos/salesOrderItem.service";
import { SalesOrderItemController } from "../../controllers/pos/salesOrderItem.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import {
    createSalesOrderItemSchema,
    salesOrderItemIdParamSchema,
    updateSalesOrderItemSchema
} from "../../utils/schemas/posMaster.schema";

const router = Router()

const salesOrderItemModel = new SalesOrderItemModels()
const salesOrderItemService = new SalesOrderItemService(salesOrderItemModel)
const salesOrderItemController = new SalesOrderItemController(salesOrderItemService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))
router.use(requireBranch)

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), salesOrderItemController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), validate(salesOrderItemIdParamSchema), salesOrderItemController.findOne)

router.post("/", authorizeRole(["Admin", "Manager", "Employee"]), validate(createSalesOrderItemSchema), salesOrderItemController.create)
router.put("/:id", authorizeRole(["Admin", "Manager", "Employee"]), validate(updateSalesOrderItemSchema), salesOrderItemController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), validate(salesOrderItemIdParamSchema), salesOrderItemController.delete)

export default router
