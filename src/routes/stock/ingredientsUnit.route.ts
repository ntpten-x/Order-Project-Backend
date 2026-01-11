import { Router } from "express";
import { IngredientsUnitModel } from "../../models/stock/ingredientsUnit.model";
import { IngredientsUnitService } from "../../services/stock/ingredientsUnit.service";
import { IngredientsUnitController } from "../../controllers/stock/ingredientsUnit.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router()

const ingredientsUnitModel = new IngredientsUnitModel()
const ingredientsUnitService = new IngredientsUnitService(ingredientsUnitModel)
const ingredientsUnitController = new IngredientsUnitController(ingredientsUnitService)

// Protect all routes
router.use(authenticateToken)
router.use(authorizeRole(["Admin"]))

router.get("/", ingredientsUnitController.findAll)
router.get("/:id", ingredientsUnitController.findOne)
router.get("/unit_name/:unit_name", ingredientsUnitController.findOneByUnitName)
router.post("/", ingredientsUnitController.create)
router.put("/:id", ingredientsUnitController.update)
router.delete("/:id", ingredientsUnitController.delete)

export default router
