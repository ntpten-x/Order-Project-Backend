import { Router } from "express";
import { OrdersItemModels } from "../../models/pos/ordersItem.model";
import { OrdersItemService } from "../../services/pos/ordersItem.service";
import { OrdersItemController } from "../../controllers/pos/ordersItem.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router()

const ordersItemModel = new OrdersItemModels()
const ordersItemService = new OrdersItemService(ordersItemModel)
const ordersItemController = new OrdersItemController(ordersItemService)

router.use(authenticateToken)

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), ordersItemController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), ordersItemController.findOne)

router.post("/", authorizeRole(["Admin", "Manager", "Employee"]), ordersItemController.create)
router.put("/:id", authorizeRole(["Admin", "Manager", "Employee"]), ordersItemController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), ordersItemController.delete)

export default router
