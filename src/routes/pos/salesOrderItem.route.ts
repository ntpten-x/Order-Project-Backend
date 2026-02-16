import { Router } from "express";
import { SalesOrderItemModels } from "../../models/pos/salesOrderItem.model";
import { SalesOrderItemService } from "../../services/pos/salesOrderItem.service";
import { SalesOrderItemController } from "../../controllers/pos/salesOrderItem.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { requireBranchStrict } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
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
router.use(requireBranchStrict)

router.get("/", authorizePermission("orders.page", "view"), salesOrderItemController.findAll)
router.get("/:id", authorizePermission("orders.page", "view"), validate(salesOrderItemIdParamSchema), salesOrderItemController.findOne)

router.post("/", authorizePermission("orders.page", "create"), validate(createSalesOrderItemSchema), salesOrderItemController.create)
router.put("/:id", authorizePermission("orders.page", "update"), validate(updateSalesOrderItemSchema), salesOrderItemController.update)
router.delete("/:id", authorizePermission("orders.page", "delete"), validate(salesOrderItemIdParamSchema), salesOrderItemController.delete)

export default router
