import { Router } from "express"
import { PaymentAccountController } from "../../controllers/pos/PaymentAccount.controller"
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware"
import { validate } from "../../middleware/validate.middleware"
import { createPaymentAccountSchema, paymentAccountIdParamSchema, updatePaymentAccountSchema } from "../../utils/schemas/posMaster.schema"
import { requireBranch } from "../../middleware/branch.middleware"

const router = Router()
const controller = new PaymentAccountController()

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager"]))
router.use(requireBranch)

router.get("/accounts", controller.getAccounts)
router.post("/accounts", validate(createPaymentAccountSchema), controller.createAccount)
router.put("/accounts/:id", validate(updatePaymentAccountSchema), controller.updateAccount)
router.patch("/accounts/:id/activate", validate(paymentAccountIdParamSchema), controller.activateAccount)
router.delete("/accounts/:id", validate(paymentAccountIdParamSchema), controller.deleteAccount)

export default router
