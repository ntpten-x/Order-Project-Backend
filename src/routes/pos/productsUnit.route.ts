import { Router } from "express";
import { ProductsUnitController } from "../../controllers/pos/productsUnit.controller";
import { ProductsUnitService } from "../../services/pos/productsUnit.service";
import { ProductsUnitModels } from "../../models/pos/productsUnit.model";
import { authenticateToken } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
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
router.use(requireBranch)

router.get("/", authorizePermission("products.page", "view"), productsUnitController.findAll)
router.get("/:id", authorizePermission("products.page", "view"), validate(productsUnitIdParamSchema), productsUnitController.findOne)
router.get("/name/:unit_name", authorizePermission("products.page", "view"), validate(productsUnitNameParamSchema), productsUnitController.findOneByName)

router.post("/", authorizePermission("products.page", "create"), validate(createProductsUnitSchema), productsUnitController.create)
router.put("/:id", authorizePermission("products.page", "update"), validate(updateProductsUnitSchema), productsUnitController.update)
router.delete("/:id", authorizePermission("products.page", "delete"), validate(productsUnitIdParamSchema), productsUnitController.delete)

export default router
