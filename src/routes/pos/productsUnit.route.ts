import { Router } from "express";
import { ProductsUnitController } from "../../controllers/pos/productsUnit.controller";
import { ProductsUnitService } from "../../services/pos/productsUnit.service";
import { ProductsUnitModels } from "../../models/pos/productsUnit.model";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
    createProductsUnitSchema,
    productsUnitIdParamSchema,
    productsUnitNameParamSchema,
    updateProductsUnitSchema
} from "../../utils/schemas/posMaster.schema";

const router = Router()

const productsUnitModel = new ProductsUnitModels()
const productsUnitService = new ProductsUnitService(productsUnitModel)
const productsUnitController = new ProductsUnitController(productsUnitService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))

router.get("/", productsUnitController.findAll)
router.get("/:id", validate(productsUnitIdParamSchema), productsUnitController.findOne)
router.get("/name/:unit_name", validate(productsUnitNameParamSchema), productsUnitController.findOneByName)

router.post("/", authorizeRole(["Admin"]), validate(createProductsUnitSchema), productsUnitController.create)
router.put("/:id", authorizeRole(["Admin"]), validate(updateProductsUnitSchema), productsUnitController.update)
router.delete("/:id", authorizeRole(["Admin"]), validate(productsUnitIdParamSchema), productsUnitController.delete)

export default router
