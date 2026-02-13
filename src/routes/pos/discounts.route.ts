import { Router } from "express";
import { DiscountsModels } from "../../models/pos/discounts.model";
import { DiscountsService } from "../../services/pos/discounts.service";
import { DiscountsController } from "../../controllers/pos/discounts.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
import {
    createDiscountSchema,
    discountIdParamSchema,
    discountNameParamSchema,
    updateDiscountSchema
} from "../../utils/schemas/posMaster.schema";

const router = Router()

const discountsModel = new DiscountsModels()
const discountsService = new DiscountsService(discountsModel)
const discountsController = new DiscountsController(discountsService)

router.use(authenticateToken)
router.use(requireBranch)

router.get("/", authorizePermission("discounts.page", "view"), discountsController.findAll)
router.get("/:id", authorizePermission("discounts.page", "view"), validate(discountIdParamSchema), discountsController.findOne)
router.get("/getByName/:name", authorizePermission("discounts.page", "view"), validate(discountNameParamSchema), discountsController.findByName)

router.post("/", authorizePermission("discounts.page", "create"), validate(createDiscountSchema), discountsController.create)
router.put("/:id", authorizePermission("discounts.page", "update"), validate(updateDiscountSchema), discountsController.update)
router.delete("/:id", authorizePermission("discounts.page", "delete"), validate(discountIdParamSchema), discountsController.delete)

export default router
