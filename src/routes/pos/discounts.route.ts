import { Router } from "express";
import { DiscountsModels } from "../../models/pos/discounts.model";
import { DiscountsService } from "../../services/pos/discounts.service";
import { DiscountsController } from "../../controllers/pos/discounts.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
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
router.use(authorizeRole(["Admin", "Manager", "Employee"]))
router.use(requireBranch)
// Authorization:
// Admin/Manager can Manage
// Employee can Read

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), discountsController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), validate(discountIdParamSchema), discountsController.findOne)
router.get("/getByName/:name", authorizeRole(["Admin", "Manager", "Employee"]), validate(discountNameParamSchema), discountsController.findByName)

router.post("/", authorizeRole(["Admin", "Manager"]), validate(createDiscountSchema), discountsController.create)
router.put("/:id", authorizeRole(["Admin", "Manager"]), validate(updateDiscountSchema), discountsController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), validate(discountIdParamSchema), discountsController.delete)

export default router
