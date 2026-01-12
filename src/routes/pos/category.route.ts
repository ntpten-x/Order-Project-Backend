import { Router } from "express";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
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
router.get("/:id", categoryController.findOne)
router.get("/name/:category_name", categoryController.findOneByName)

router.post("/", authorizeRole(["Admin"]), categoryController.create)
router.put("/:id", authorizeRole(["Admin"]), categoryController.update)
router.delete("/:id", authorizeRole(["Admin"]), categoryController.delete)

export default router
