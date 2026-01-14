import { Router } from "express";
import { OrdersModels } from "../../models/pos/orders.model";
import { OrdersService } from "../../services/pos/orders.service";
import { OrdersController } from "../../controllers/pos/orders.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router()

const ordersModel = new OrdersModels()
const ordersService = new OrdersService(ordersModel)
const ordersController = new OrdersController(ordersService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), ordersController.findAll)
router.get("/items", authorizeRole(["Admin", "Manager", "Employee"]), ordersController.findAllItems)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), ordersController.findOne)

router.post("/", authorizeRole(["Admin", "Manager", "Employee"]), ordersController.create)
router.put("/:id", authorizeRole(["Admin", "Manager", "Employee"]), ordersController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), ordersController.delete)
router.patch("/items/:id/status", authorizeRole(["Admin", "Manager", "Employee"]), ordersController.updateItemStatus)

// Item Management Routes
router.post("/:id/items", authorizeRole(["Admin", "Manager", "Employee"]), ordersController.addItem)
router.put("/items/:itemId", authorizeRole(["Admin", "Manager", "Employee"]), ordersController.updateItem)
router.delete("/items/:itemId", authorizeRole(["Admin", "Manager"]), ordersController.deleteItem)

export default router
