import { Router } from "express";
import { ProductsUnitController } from "../../controllers/pos/productsUnit.controller";
import { ProductsUnitService } from "../../services/pos/productsUnit.service";
import { ProductsUnitModels } from "../../models/pos/productsUnit.model";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router()

const productsUnitModel = new ProductsUnitModels()
const productsUnitService = new ProductsUnitService(productsUnitModel)
const productsUnitController = new ProductsUnitController(productsUnitService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))

router.get("/", productsUnitController.findAll)
router.get("/:id", productsUnitController.findOne)
router.get("/name/:unit_name", productsUnitController.findOneByName)

router.post("/", authorizeRole(["Admin"]), productsUnitController.create)
router.put("/:id", authorizeRole(["Admin"]), productsUnitController.update)
router.delete("/:id", authorizeRole(["Admin"]), productsUnitController.delete)

export default router