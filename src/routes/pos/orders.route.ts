import { Router } from "express";
import { OrdersModels } from "../../models/pos/orders.model";
import { OrdersService } from "../../services/pos/orders.service";
import { OrdersController } from "../../controllers/pos/orders.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission, enforceOrderItemTargetScope, enforceOrderTargetScope } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validate.middleware";
import { addOrderItemSchema, createOrderSchema, orderIdParamSchema, orderItemIdParamSchema, updateOrderItemSchema, updateOrderItemStatusSchema, updateOrderSchema } from "../../utils/schemas/posOrders.schema";

const router = Router()

const ordersModel = new OrdersModels()
const ordersService = new OrdersService(ordersModel)
const ordersController = new OrdersController(ordersService)

router.use(authenticateToken)
router.use(requireBranch)

// Specific routes must come before dynamic routes like /:id
router.get("/stats", authorizePermission("orders.page", "view"), ordersController.getStats)
router.get("/summary", authorizePermission("orders.page", "view"), ordersController.findSummary)

router.get("/", authorizePermission("orders.page", "view"), ordersController.findAll)
router.get("/items", authorizePermission("orders.page", "view"), ordersController.findAllItems)
router.get("/:id", authorizePermission("orders.page", "view"), enforceOrderTargetScope("id"), validate(orderIdParamSchema), ordersController.findOne)

router.post("/", authorizePermission("orders.page", "create"), validate(createOrderSchema), ordersController.create)
router.put("/:id", authorizePermission("orders.page", "update"), enforceOrderTargetScope("id"), validate(updateOrderSchema), ordersController.update)
router.delete("/:id", authorizePermission("orders.page", "delete"), enforceOrderTargetScope("id"), validate(orderIdParamSchema), ordersController.delete)
router.patch("/items/:id/status", authorizePermission("orders.page", "update"), enforceOrderItemTargetScope("id"), validate(updateOrderItemStatusSchema), ordersController.updateItemStatus)

// Item Management Routes
router.post("/:id/items", authorizePermission("orders.page", "update"), enforceOrderTargetScope("id"), validate(addOrderItemSchema), ordersController.addItem)
router.put("/items/:itemId", authorizePermission("orders.page", "update"), enforceOrderItemTargetScope("itemId"), validate(updateOrderItemSchema), ordersController.updateItem)
router.delete("/items/:itemId", authorizePermission("orders.page", "delete"), enforceOrderItemTargetScope("itemId"), validate(orderItemIdParamSchema), ordersController.deleteItem)

export default router
