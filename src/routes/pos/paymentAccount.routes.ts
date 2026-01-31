import { Router } from "express"
import { PaymentAccountController } from "../../controllers/pos/PaymentAccount.controller"
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware"
import { validate } from "../../middleware/validate.middleware"
import { createPaymentAccountSchema, paymentAccountIdParamSchema, updatePaymentAccountSchema } from "../../utils/schemas/posMaster.schema"

const router = Router()
const controller = new PaymentAccountController()

router.use(authenticateToken)
router.use(authorizeRole(["Admin"]))

router.get("/accounts", (req, res) => controller.getAccounts(req, res))
router.post("/accounts", validate(createPaymentAccountSchema), (req, res) => controller.createAccount(req, res))
router.put("/accounts/:id", validate(updatePaymentAccountSchema), (req, res) => controller.updateAccount(req, res))
router.patch("/accounts/:id/activate", validate(paymentAccountIdParamSchema), (req, res) => controller.activateAccount(req, res))
router.delete("/accounts/:id", validate(paymentAccountIdParamSchema), (req, res) => controller.deleteAccount(req, res))

export default router
