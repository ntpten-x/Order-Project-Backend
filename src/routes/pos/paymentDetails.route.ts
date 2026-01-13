import { Router } from "express";
import { PaymentDetailsModels } from "../../models/pos/paymentDetails.model";
import { PaymentDetailsService } from "../../services/pos/paymentDetails.service";
import { PaymentDetailsController } from "../../controllers/pos/paymentDetails.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router()

const paymentDetailsModel = new PaymentDetailsModels()
const paymentDetailsService = new PaymentDetailsService(paymentDetailsModel)
const paymentDetailsController = new PaymentDetailsController(paymentDetailsService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), paymentDetailsController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), paymentDetailsController.findOne)

router.post("/", authorizeRole(["Admin", "Manager", "Employee"]), paymentDetailsController.create)
router.put("/:id", authorizeRole(["Admin", "Manager", "Employee"]), paymentDetailsController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), paymentDetailsController.delete)

export default router
