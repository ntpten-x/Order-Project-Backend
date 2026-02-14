import { Router } from "express";
import { PaymentsModels } from "../../models/pos/payments.model";
import { PaymentsService } from "../../services/pos/payments.service";
import { PaymentsController } from "../../controllers/pos/payments.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { validate } from "../../middleware/validate.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
import { createPaymentSchema, paymentIdParamSchema, updatePaymentSchema } from "../../utils/schemas/payments.schema";

const router = Router()

const paymentsModel = new PaymentsModels()
const paymentsService = new PaymentsService(paymentsModel)
const paymentsController = new PaymentsController(paymentsService)

router.use(authenticateToken)
router.use(requireBranch)

router.get("/", authorizePermission("payments.page", "view"), paymentsController.findAll)
router.get("/:id", authorizePermission("payments.page", "view"), validate(paymentIdParamSchema), paymentsController.findOne)

router.post("/", authorizePermission("payments.page", "create"), validate(createPaymentSchema), paymentsController.create)
router.put("/:id", authorizePermission("payments.page", "update"), validate(updatePaymentSchema), paymentsController.update)
router.delete("/:id", authorizePermission("payments.page", "delete"), validate(paymentIdParamSchema), paymentsController.delete)

export default router
