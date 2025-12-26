import { Router } from "express";
import { IngredientsUnitModel } from "../models/ingredientsUnit.model";
import { IngredientsUnitService } from "../services/ingredientsUnit.service";
import { IngredientsUnitController } from "../controllers/ingredientsUnit.controller";

const router = Router()

const ingredientsUnitModel = new IngredientsUnitModel()
const ingredientsUnitService = new IngredientsUnitService(ingredientsUnitModel)
const ingredientsUnitController = new IngredientsUnitController(ingredientsUnitService)

router.get("/", ingredientsUnitController.findAll)
router.get("/:id", ingredientsUnitController.findOne)
router.get("/unit_name/:unit_name", ingredientsUnitController.findOneByUnitName)
router.post("/", ingredientsUnitController.create)
router.put("/:id", ingredientsUnitController.update)
router.delete("/:id", ingredientsUnitController.delete)

export default router
