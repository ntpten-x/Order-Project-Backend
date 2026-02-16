import { Router } from "express";
import { SalesOrderDetailModels } from "../../models/pos/salesOrderDetail.model";
import { SalesOrderDetailService } from "../../services/pos/salesOrderDetail.service";
import { SalesOrderDetailController } from "../../controllers/pos/salesOrderDetail.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { requireBranchStrict } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
import {
    createSalesOrderDetailSchema,
    salesOrderDetailIdParamSchema,
    updateSalesOrderDetailSchema
} from "../../utils/schemas/posMaster.schema";

const router = Router()

const salesOrderDetailModel = new SalesOrderDetailModels()
const salesOrderDetailService = new SalesOrderDetailService(salesOrderDetailModel)
const salesOrderDetailController = new SalesOrderDetailController(salesOrderDetailService)

router.use(authenticateToken)
router.use(requireBranchStrict)

router.get("/", authorizePermission("orders.page", "view"), salesOrderDetailController.findAll)
router.get("/:id", authorizePermission("orders.page", "view"), validate(salesOrderDetailIdParamSchema), salesOrderDetailController.findOne)

router.post("/", authorizePermission("orders.page", "create"), validate(createSalesOrderDetailSchema), salesOrderDetailController.create)
router.put("/:id", authorizePermission("orders.page", "update"), validate(updateSalesOrderDetailSchema), salesOrderDetailController.update)
router.delete("/:id", authorizePermission("orders.page", "delete"), validate(salesOrderDetailIdParamSchema), salesOrderDetailController.delete)

export default router
