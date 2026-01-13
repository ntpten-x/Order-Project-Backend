import { Router } from "express";
import { DeliveryModels } from "../../models/pos/delivery.model";
import { DeliveryService } from "../../services/pos/delivery.service";
import { DeliveryController } from "../../controllers/pos/delivery.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router()

const deliveryModel = new DeliveryModels()
const deliveryService = new DeliveryService(deliveryModel)
const deliveryController = new DeliveryController(deliveryService)

router.use(authenticateToken)
// Authorization: 
// Admin/Manager can Manage
// Employee can View

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), deliveryController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), deliveryController.findOne)

router.post("/", authorizeRole(["Admin", "Manager"]), deliveryController.create)
router.put("/:id", authorizeRole(["Admin", "Manager"]), deliveryController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), deliveryController.delete)

export default router
