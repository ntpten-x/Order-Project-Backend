import { Router } from "express";
import { ProductsModels } from "../../models/pos/products.model";
import { ProductsService } from "../../services/pos/products.service";
import { ProductsController } from "../../controllers/pos/products.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router()

const productsModel = new ProductsModels()
const productsService = new ProductsService(productsModel)
const productsController = new ProductsController(productsService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))

router.get("/", productsController.findAll)
router.get("/:id", productsController.findOne)
router.get("/name/:product_name", productsController.findOneByName)

router.post("/", authorizeRole(["Admin"]), productsController.create)
router.put("/:id", authorizeRole(["Admin"]), productsController.update)
router.delete("/:id", authorizeRole(["Admin"]), productsController.delete)

export default router