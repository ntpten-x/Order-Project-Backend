import { Router } from "express";
import { SalesOrderDetailModels } from "../../models/pos/salesOrderDetail.model";
import { SalesOrderDetailService } from "../../services/pos/salesOrderDetail.service";
import { SalesOrderDetailController } from "../../controllers/pos/salesOrderDetail.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
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
router.use(authorizeRole(["Admin", "Manager", "Employee"]))
router.use(requireBranch)

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), salesOrderDetailController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), validate(salesOrderDetailIdParamSchema), salesOrderDetailController.findOne)

router.post("/", authorizeRole(["Admin", "Manager", "Employee"]), validate(createSalesOrderDetailSchema), salesOrderDetailController.create)
router.put("/:id", authorizeRole(["Admin", "Manager", "Employee"]), validate(updateSalesOrderDetailSchema), salesOrderDetailController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), validate(salesOrderDetailIdParamSchema), salesOrderDetailController.delete)

export default router
