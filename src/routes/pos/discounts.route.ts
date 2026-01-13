import { Router } from "express";
import { DiscountsModels } from "../../models/pos/discounts.model";
import { DiscountsService } from "../../services/pos/discounts.service";
import { DiscountsController } from "../../controllers/pos/discounts.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router()

const discountsModel = new DiscountsModels()
const discountsService = new DiscountsService(discountsModel)
const discountsController = new DiscountsController(discountsService)

router.use(authenticateToken)
// Authorization:
// Admin/Manager can Manage
// Employee can Read

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), discountsController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), discountsController.findOne)

router.post("/", authorizeRole(["Admin", "Manager"]), discountsController.create)
router.put("/:id", authorizeRole(["Admin", "Manager"]), discountsController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), discountsController.delete)

export default router
