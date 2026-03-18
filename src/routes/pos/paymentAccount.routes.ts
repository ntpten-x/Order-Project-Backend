import { Router } from "express"
import { PaymentAccountController } from "../../controllers/pos/PaymentAccount.controller"
import { authenticateToken } from "../../middleware/auth.middleware"
import { validate } from "../../middleware/validate.middleware"
import { createPaymentAccountSchema, paymentAccountIdParamSchema, updatePaymentAccountSchema } from "../../utils/schemas/posMaster.schema"
import { requireBranch } from "../../middleware/branch.middleware"
import { authorizePermission, authorizeResolvedPermissions } from "../../middleware/permission.middleware"

const router = Router()
const controller = new PaymentAccountController()

router.use(authenticateToken)
router.use(requireBranch)

router.get(
    "/accounts",
    authorizeResolvedPermissions((req) => [
        { resourceKey: "payment_accounts.page", actionKey: "view" },
        ...(String(req.query.q || "").trim() ? [{ resourceKey: "payment_accounts.search.feature", actionKey: "view" }] : []),
        ...(String(req.query.status || "").trim() ? [{ resourceKey: "payment_accounts.filter.feature", actionKey: "view" }] : []),
    ]),
    controller.getAccounts
)
router.get("/accounts/:id", authorizePermission("payment_accounts.detail.feature", "view"), validate(paymentAccountIdParamSchema), controller.getAccount)
router.post("/accounts", authorizePermission("payment_accounts.create.feature", "create"), validate(createPaymentAccountSchema), controller.createAccount)
router.put("/accounts/:id", authorizePermission("payment_accounts.edit.feature", "update"), validate(updatePaymentAccountSchema), controller.updateAccount)
router.patch("/accounts/:id/activate", authorizePermission("payment_accounts.activate.feature", "update"), validate(paymentAccountIdParamSchema), controller.activateAccount)
router.delete("/accounts/:id", authorizePermission("payment_accounts.delete.feature", "delete"), validate(paymentAccountIdParamSchema), controller.deleteAccount)

export default router
