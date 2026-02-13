import { Router } from "express";
import { ProductsModels } from "../../models/pos/products.model";
import { ProductsService } from "../../services/pos/products.service";
import { ProductsController } from "../../controllers/pos/products.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
    createProductSchema,
    productIdParamSchema,
    productNameParamSchema,
    updateProductSchema
} from "../../utils/schemas/posMaster.schema";
import { paginationQuerySchema } from "../../utils/schemas/common.schema";

const router = Router()

const productsModel = new ProductsModels()
const productsService = new ProductsService(productsModel)
const productsController = new ProductsController(productsService)

router.use(authenticateToken)
router.use(requireBranch)

router.get("/", authorizePermission("products.page", "view"), validate(paginationQuerySchema), productsController.findAll)
router.get("/:id", authorizePermission("products.page", "view"), validate(productIdParamSchema), productsController.findOne)
router.get("/name/:product_name", authorizePermission("products.page", "view"), validate(productNameParamSchema), productsController.findOneByName)

router.post("/", authorizePermission("products.page", "create"), validate(createProductSchema), productsController.create)
router.put("/:id", authorizePermission("products.page", "update"), validate(updateProductSchema), productsController.update)
router.delete("/:id", authorizePermission("products.page", "delete"), validate(productIdParamSchema), productsController.delete)

export default router
