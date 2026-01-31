import { Router } from "express";
import { PaymentMethodModels } from "../../models/pos/paymentMethod.model";
import { PaymentMethodService } from "../../services/pos/paymentMethod.service";
import { PaymentMethodController } from "../../controllers/pos/paymentMethod.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
    createPaymentMethodSchema,
    paymentMethodIdParamSchema,
    paymentMethodNameParamSchema,
    updatePaymentMethodSchema
} from "../../utils/schemas/posMaster.schema";

const router = Router()

const paymentMethodModel = new PaymentMethodModels()
const paymentMethodService = new PaymentMethodService(paymentMethodModel)
const paymentMethodController = new PaymentMethodController(paymentMethodService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))
// Authorization:
// Admin manage, Employee read.

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), paymentMethodController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), validate(paymentMethodIdParamSchema), paymentMethodController.findOne)
router.get("/getByName/:name", authorizeRole(["Admin", "Manager", "Employee"]), validate(paymentMethodNameParamSchema), paymentMethodController.findByName)

router.post("/", authorizeRole(["Admin"]), validate(createPaymentMethodSchema), paymentMethodController.create)
router.put("/:id", authorizeRole(["Admin"]), validate(updatePaymentMethodSchema), paymentMethodController.update)
router.delete("/:id", authorizeRole(["Admin"]), validate(paymentMethodIdParamSchema), paymentMethodController.delete)

export default router
