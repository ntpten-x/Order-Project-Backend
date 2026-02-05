import { Router } from "express";
import { IngredientsModel } from "../../models/stock/ingredients.model";
import { IngredientsService } from "../../services/stock/ingredients.service";
import { IngredientsController } from "../../controllers/stock/ingredients.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { validate } from "../../middleware/validate.middleware";
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
router.use(authorizeRole(["Admin", "Manager"]))
router.use(requireBranch)

// Public-ish routes (All authenticated roles)
router.get("/", ingredientsController.findAll)
router.get("/:id", validate(ingredientIdParamSchema), ingredientsController.findOne)
router.get("/name/:ingredient_name", validate(ingredientNameParamSchema), ingredientsController.findOneByName)

// Admin/Manager routes for management
router.post("/", authorizeRole(["Admin", "Manager"]), validate(createIngredientSchema), ingredientsController.create)
router.put("/:id", authorizeRole(["Admin", "Manager"]), validate(updateIngredientSchema), ingredientsController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), validate(ingredientIdParamSchema), ingredientsController.delete)

export default router
