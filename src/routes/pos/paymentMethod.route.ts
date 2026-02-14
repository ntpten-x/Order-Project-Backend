import { Router } from "express";
import { PaymentMethodModels } from "../../models/pos/paymentMethod.model";
import { PaymentMethodService } from "../../services/pos/paymentMethod.service";
import { PaymentMethodController } from "../../controllers/pos/paymentMethod.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
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
router.use(requireBranch)

router.get("/", authorizePermission("payment_method.page", "view"), paymentMethodController.findAll)
router.get("/:id", authorizePermission("payment_method.page", "view"), validate(paymentMethodIdParamSchema), paymentMethodController.findOne)
router.get("/getByName/:name", authorizePermission("payment_method.page", "view"), validate(paymentMethodNameParamSchema), paymentMethodController.findByName)

router.post("/", authorizePermission("payment_method.page", "create"), validate(createPaymentMethodSchema), paymentMethodController.create)
router.put("/:id", authorizePermission("payment_method.page", "update"), validate(updatePaymentMethodSchema), paymentMethodController.update)
router.delete("/:id", authorizePermission("payment_method.page", "delete"), validate(paymentMethodIdParamSchema), paymentMethodController.delete)

export default router
