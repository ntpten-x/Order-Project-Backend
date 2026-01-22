import { Router } from "express";
import { OrdersModels } from "../../models/pos/orders.model";
import { OrdersService } from "../../services/pos/orders.service";
import { OrdersController } from "../../controllers/pos/orders.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { addOrderItemSchema, createOrderSchema, orderIdParamSchema, orderItemIdParamSchema, updateOrderItemSchema, updateOrderItemStatusSchema, updateOrderSchema } from "../../utils/schemas/posOrders.schema";

const router = Router()

const ordersModel = new OrdersModels()
const ordersService = new OrdersService(ordersModel)
const ordersController = new OrdersController(ordersService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))

// Specific routes must come before dynamic routes like /:id
router.get("/stats", authorizeRole(["Admin", "Manager", "Employee"]), ordersController.getStats)

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), ordersController.findAll)
router.get("/items", authorizeRole(["Admin", "Manager", "Employee"]), ordersController.findAllItems)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), validate(orderIdParamSchema), ordersController.findOne)

router.post("/", authorizeRole(["Admin", "Manager", "Employee"]), validate(createOrderSchema), ordersController.create)
router.put("/:id", authorizeRole(["Admin", "Manager", "Employee"]), validate(updateOrderSchema), ordersController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), validate(orderIdParamSchema), ordersController.delete)
router.patch("/items/:id/status", authorizeRole(["Admin", "Manager", "Employee"]), validate(updateOrderItemStatusSchema), ordersController.updateItemStatus)

// Item Management Routes
router.post("/:id/items", authorizeRole(["Admin", "Manager", "Employee"]), validate(addOrderItemSchema), ordersController.addItem)
router.put("/items/:itemId", authorizeRole(["Admin", "Manager", "Employee"]), validate(updateOrderItemSchema), ordersController.updateItem)
router.delete("/items/:itemId", authorizeRole(["Admin", "Manager"]), validate(orderItemIdParamSchema), ordersController.deleteItem)

export default router
