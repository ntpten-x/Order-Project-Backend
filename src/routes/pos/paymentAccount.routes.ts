import { Router } from "express"
import { PaymentAccountController } from "../../controllers/pos/PaymentAccount.controller"

const router = Router()
const controller = new PaymentAccountController()

router.get("/accounts", (req, res) => controller.getAccounts(req, res))
router.post("/accounts", (req, res) => controller.createAccount(req, res))
router.put("/accounts/:id", (req, res) => controller.updateAccount(req, res))
router.patch("/accounts/:id/activate", (req, res) => controller.activateAccount(req, res))
router.delete("/accounts/:id", (req, res) => controller.deleteAccount(req, res))

export default router
