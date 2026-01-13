import { Router } from "express";
import { PaymentMethodModels } from "../../models/pos/paymentMethod.model";
import { PaymentMethodService } from "../../services/pos/paymentMethod.service";
import { PaymentMethodController } from "../../controllers/pos/paymentMethod.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router()

const paymentMethodModel = new PaymentMethodModels()
const paymentMethodService = new PaymentMethodService(paymentMethodModel)
const paymentMethodController = new PaymentMethodController(paymentMethodService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))
// Authorization:
// Admin manage, Employee read.

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), paymentMethodController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), paymentMethodController.findOne)
router.get("/getByName/:name", authorizeRole(["Admin", "Manager", "Employee"]), paymentMethodController.findByName)

router.post("/", authorizeRole(["Admin"]), paymentMethodController.create)
router.put("/:id", authorizeRole(["Admin"]), paymentMethodController.update)
router.delete("/:id", authorizeRole(["Admin"]), paymentMethodController.delete)

export default router
