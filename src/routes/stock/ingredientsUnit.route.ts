import { Router } from "express";
import { IngredientsUnitModel } from "../../models/stock/ingredientsUnit.model";
import { IngredientsUnitService } from "../../services/stock/ingredientsUnit.service";
import { IngredientsUnitController } from "../../controllers/stock/ingredientsUnit.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { validate } from "../../middleware/validate.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
import { paginationQuerySchema } from "../../utils/schemas/common.schema";
import {
    createIngredientUnitSchema,
    ingredientUnitIdParamSchema,
    ingredientUnitNameParamSchema,
    updateIngredientUnitSchema
} from "../../utils/schemas/stock.schema";

const router = Router()

const ingredientsUnitModel = new IngredientsUnitModel()
const ingredientsUnitService = new IngredientsUnitService(ingredientsUnitModel)
const ingredientsUnitController = new IngredientsUnitController(ingredientsUnitService)

// Protect all routes
router.use(authenticateToken)
router.use(requireBranch)

router.get("/", authorizePermission("stock.ingredients_unit.page", "view"), validate(paginationQuerySchema), ingredientsUnitController.findAll)
router.get("/:id", authorizePermission("stock.ingredients_unit.page", "view"), validate(ingredientUnitIdParamSchema), ingredientsUnitController.findOne)
router.get("/unit_name/:unit_name", authorizePermission("stock.ingredients_unit.page", "view"), validate(ingredientUnitNameParamSchema), ingredientsUnitController.findOneByUnitName)
router.post("/", authorizePermission("stock.ingredients_unit.page", "create"), validate(createIngredientUnitSchema), ingredientsUnitController.create)
router.put("/:id", authorizePermission("stock.ingredients_unit.page", "update"), validate(updateIngredientUnitSchema), ingredientsUnitController.update)
router.delete("/:id", authorizePermission("stock.ingredients_unit.page", "delete"), validate(ingredientUnitIdParamSchema), ingredientsUnitController.delete)

export default router
