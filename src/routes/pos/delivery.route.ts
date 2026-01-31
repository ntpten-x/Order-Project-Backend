import { Router } from "express";
import { DeliveryModels } from "../../models/pos/delivery.model";
import { DeliveryService } from "../../services/pos/delivery.service";
import { DeliveryController } from "../../controllers/pos/delivery.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { paginationQuerySchema } from "../../utils/schemas/common.schema";
import {
    createDeliverySchema,
    deliveryIdParamSchema,
    deliveryNameParamSchema,
    updateDeliverySchema
} from "../../utils/schemas/posMaster.schema";

const router = Router()

const deliveryModel = new DeliveryModels()
const deliveryService = new DeliveryService(deliveryModel)
const deliveryController = new DeliveryController(deliveryService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))
// Authorization: 
// Admin/Manager can Manage
// Employee can View

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), validate(paginationQuerySchema), deliveryController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), validate(deliveryIdParamSchema), deliveryController.findOne)
router.get("/getByName/:name", authorizeRole(["Admin", "Manager", "Employee"]), validate(deliveryNameParamSchema), deliveryController.findByName)

router.post("/", authorizeRole(["Admin", "Manager"]), validate(createDeliverySchema), deliveryController.create)
router.put("/:id", authorizeRole(["Admin", "Manager"]), validate(updateDeliverySchema), deliveryController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), validate(deliveryIdParamSchema), deliveryController.delete)

export default router
