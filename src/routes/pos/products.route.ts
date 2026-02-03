import { Router } from "express";
import { ProductsModels } from "../../models/pos/products.model";
import { ProductsService } from "../../services/pos/products.service";
import { ProductsController } from "../../controllers/pos/products.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
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
router.use(authorizeRole(["Admin", "Manager", "Employee"]))

router.get("/", validate(paginationQuerySchema), productsController.findAll)
router.get("/:id", validate(productIdParamSchema), productsController.findOne)
router.get("/name/:product_name", validate(productNameParamSchema), productsController.findOneByName)

router.post("/", authorizeRole(["Admin", "Manager"]), validate(createProductSchema), productsController.create)
router.put("/:id", authorizeRole(["Admin", "Manager"]), validate(updateProductSchema), productsController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), validate(productIdParamSchema), productsController.delete)

export default router
