import { Router } from "express";
import { IngredientsModel } from "../../models/stock/ingredients.model";
import { IngredientsService } from "../../services/stock/ingredients.service";
import { IngredientsController } from "../../controllers/stock/ingredients.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router()

const ingredientsModel = new IngredientsModel()
const ingredientsService = new IngredientsService(ingredientsModel)
const ingredientsController = new IngredientsController(ingredientsService)

// Protect all routes
router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))

// Public-ish routes (All authenticated roles)
router.get("/", ingredientsController.findAll)
router.get("/:id", ingredientsController.findOne)
router.get("/name/:ingredient_name", ingredientsController.findOneByName)

// Admin only routes for management
router.post("/", authorizeRole(["Admin"]), ingredientsController.create)
router.put("/:id", authorizeRole(["Admin"]), ingredientsController.update)
router.delete("/:id", authorizeRole(["Admin"]), ingredientsController.delete)

export default router
