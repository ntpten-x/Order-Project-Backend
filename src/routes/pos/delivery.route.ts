import { Router } from "express";
import { DeliveryModels } from "../../models/pos/delivery.model";
import { DeliveryService } from "../../services/pos/delivery.service";
import { DeliveryController } from "../../controllers/pos/delivery.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
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
router.use(requireBranch)

router.get("/", authorizePermission("delivery.page", "view"), validate(paginationQuerySchema), deliveryController.findAll)
router.get("/:id", authorizePermission("delivery.page", "view"), validate(deliveryIdParamSchema), deliveryController.findOne)
router.get(
    "/getByName/:name",
    authorizePermission("delivery.manager.feature", "access"),
    validate(deliveryNameParamSchema),
    deliveryController.findByName
)

router.post(
    "/",
    authorizePermission("delivery.page", "create"),
    authorizePermission("delivery.manager.feature", "access"),
    authorizePermission("delivery.create.feature", "create"),
    validate(createDeliverySchema),
    deliveryController.create
)
router.put(
    "/:id",
    authorizePermission("delivery.page", "update"),
    authorizePermission("delivery.manager.feature", "access"),
    validate(updateDeliverySchema),
    deliveryController.update
)
router.delete(
    "/:id",
    authorizePermission("delivery.page", "delete"),
    authorizePermission("delivery.manager.feature", "access"),
    authorizePermission("delivery.delete.feature", "delete"),
    validate(deliveryIdParamSchema),
    deliveryController.delete
)

export default router
