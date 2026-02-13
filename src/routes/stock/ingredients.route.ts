import { Router } from "express";
import { IngredientsModel } from "../../models/stock/ingredients.model";
import { IngredientsService } from "../../services/stock/ingredients.service";
import { IngredientsController } from "../../controllers/stock/ingredients.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { validate } from "../../middleware/validate.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
import {
    createIngredientSchema,
    ingredientIdParamSchema,
    ingredientNameParamSchema,
    updateIngredientSchema
} from "../../utils/schemas/stock.schema";

const router = Router()

const ingredientsModel = new IngredientsModel()
const ingredientsService = new IngredientsService(ingredientsModel)
const ingredientsController = new IngredientsController(ingredientsService)

// Protect all routes
router.use(authenticateToken)
router.use(requireBranch)

// Public-ish routes (All authenticated roles)
router.get("/", authorizePermission("stock.ingredients.page", "view"), ingredientsController.findAll)
router.get("/:id", authorizePermission("stock.ingredients.page", "view"), validate(ingredientIdParamSchema), ingredientsController.findOne)
router.get("/name/:ingredient_name", authorizePermission("stock.ingredients.page", "view"), validate(ingredientNameParamSchema), ingredientsController.findOneByName)

// Admin/Manager routes for management
router.post("/", authorizePermission("stock.ingredients.page", "create"), validate(createIngredientSchema), ingredientsController.create)
router.put("/:id", authorizePermission("stock.ingredients.page", "update"), validate(updateIngredientSchema), ingredientsController.update)
router.delete("/:id", authorizePermission("stock.ingredients.page", "delete"), validate(ingredientIdParamSchema), ingredientsController.delete)

export default router
