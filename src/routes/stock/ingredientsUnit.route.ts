import { Router } from "express";
import { IngredientsUnitModel } from "../../models/stock/ingredientsUnit.model";
import { IngredientsUnitService } from "../../services/stock/ingredientsUnit.service";
import { IngredientsUnitController } from "../../controllers/stock/ingredientsUnit.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { validate } from "../../middleware/validate.middleware";
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
router.use(authorizeRole(["Admin"]))
router.use(requireBranch)

router.get("/", ingredientsUnitController.findAll)
router.get("/:id", validate(ingredientUnitIdParamSchema), ingredientsUnitController.findOne)
router.get("/unit_name/:unit_name", validate(ingredientUnitNameParamSchema), ingredientsUnitController.findOneByUnitName)
router.post("/", validate(createIngredientUnitSchema), ingredientsUnitController.create)
router.put("/:id", validate(updateIngredientUnitSchema), ingredientsUnitController.update)
router.delete("/:id", validate(ingredientUnitIdParamSchema), ingredientsUnitController.delete)

export default router
