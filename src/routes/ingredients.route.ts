import { Router } from "express";
import { IngredientsModel } from "../models/ingredients.model";
import { IngredientsService } from "../services/ingredients.service";
import { IngredientsController } from "../controllers/ingredients.controller";
import { authenticateToken, authorizeRole } from "../middleware/auth.middleware";

const router = Router()

const ingredientsModel = new IngredientsModel()
const ingredientsService = new IngredientsService(ingredientsModel)
const ingredientsController = new IngredientsController(ingredientsService)

// Protect all routes
router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))

router.get("/", ingredientsController.findAll)
router.get("/:id", ingredientsController.findOne)
router.get("/name/:ingredient_name", ingredientsController.findOneByName)
router.post("/", ingredientsController.create)
router.put("/:id", ingredientsController.update)
router.delete("/:id", ingredientsController.delete)

export default router
