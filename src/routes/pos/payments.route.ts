import { Router } from "express";
import { PaymentsModels } from "../../models/pos/payments.model";
import { PaymentsService } from "../../services/pos/payments.service";
import { PaymentsController } from "../../controllers/pos/payments.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createPaymentSchema, paymentIdParamSchema, updatePaymentSchema } from "../../utils/schemas/payments.schema";

const router = Router()

const paymentsModel = new PaymentsModels()
const paymentsService = new PaymentsService(paymentsModel)
const paymentsController = new PaymentsController(paymentsService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))
// Authorization: 
// Admin/Manager manage, Employee usually creates payments.
// Allowing Employee to Create/Read/Update (if needed) but maybe restrict Delete to Admin/Manager?
// For now, consistent with other modules: Admin/Manager manage, Employee read + create (as they take orders).

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), paymentsController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), validate(paymentIdParamSchema), paymentsController.findOne)

router.post("/", authorizeRole(["Admin", "Manager", "Employee"]), validate(createPaymentSchema), paymentsController.create)
router.put("/:id", authorizeRole(["Admin", "Manager", "Employee"]), validate(updatePaymentSchema), paymentsController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), validate(paymentIdParamSchema), paymentsController.delete)

export default router
