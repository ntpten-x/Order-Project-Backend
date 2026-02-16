import { Router } from "express"
import { PaymentAccountController } from "../../controllers/pos/PaymentAccount.controller"
import { authenticateToken } from "../../middleware/auth.middleware"
import { validate } from "../../middleware/validate.middleware"
import { createPaymentAccountSchema, paymentAccountIdParamSchema, updatePaymentAccountSchema } from "../../utils/schemas/posMaster.schema"
import { requireBranchStrict } from "../../middleware/branch.middleware"
import { authorizePermission } from "../../middleware/permission.middleware"

const router = Router()
const controller = new PaymentAccountController()

router.use(authenticateToken)
router.use(requireBranchStrict)

router.get("/accounts", authorizePermission("payment_accounts.page", "view"), controller.getAccounts)
router.post("/accounts", authorizePermission("payment_accounts.page", "create"), validate(createPaymentAccountSchema), controller.createAccount)
router.put("/accounts/:id", authorizePermission("payment_accounts.page", "update"), validate(updatePaymentAccountSchema), controller.updateAccount)
router.patch("/accounts/:id/activate", authorizePermission("payment_accounts.page", "update"), validate(paymentAccountIdParamSchema), controller.activateAccount)
router.delete("/accounts/:id", authorizePermission("payment_accounts.page", "delete"), validate(paymentAccountIdParamSchema), controller.deleteAccount)

export default router
