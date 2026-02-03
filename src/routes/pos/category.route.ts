import { Router } from "express";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
    categoryIdParamSchema,
    categoryNameParamSchema,
    createCategorySchema,
    updateCategorySchema
} from "../../utils/schemas/posMaster.schema";
import { CategoryController } from "../../controllers/pos/category.controller";
import { CategoryService } from "../../services/pos/category.service";
import { CategoryModels } from "../../models/pos/category.model";

const router = Router()

const categoryModel = new CategoryModels()
const categoryService = new CategoryService(categoryModel)
const categoryController = new CategoryController(categoryService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))

router.get("/", categoryController.findAll)
router.get("/:id", validate(categoryIdParamSchema), categoryController.findOne)
router.get("/name/:category_name", validate(categoryNameParamSchema), categoryController.findOneByName)

router.post("/", authorizeRole(["Admin", "Manager"]), validate(createCategorySchema), categoryController.create)
router.put("/:id", authorizeRole(["Admin", "Manager"]), validate(updateCategorySchema), categoryController.update)
router.delete("/:id", authorizeRole(["Admin", "Manager"]), validate(categoryIdParamSchema), categoryController.delete)

export default router
