import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
import {
    categoryIdParamSchema,
    categoryNameParamSchema,
    createCategorySchema,
    updateCategorySchema
} from "../../utils/schemas/posMaster.schema";
import { CategoryController } from "../../controllers/pos/category.controller";
import { CategoryService } from "../../services/pos/category.service";
import { CategoryModels } from "../../models/pos/category.model";
import { requireBranch } from "../../middleware/branch.middleware";
import { paginationQuerySchema } from "../../utils/schemas/common.schema";

const router = Router()

const categoryModel = new CategoryModels()
const categoryService = new CategoryService(categoryModel)
const categoryController = new CategoryController(categoryService)

router.use(authenticateToken)
router.use(requireBranch)

router.get("/", authorizePermission("category.page", "view"), validate(paginationQuerySchema), categoryController.findAll)
router.get(
    "/name/:name",
    authorizePermission("category.manager.feature", "access"),
    validate(categoryNameParamSchema),
    categoryController.findOneByName
)
router.get("/:id", authorizePermission("category.page", "view"), validate(categoryIdParamSchema), categoryController.findOne)

router.post(
    "/",
    authorizePermission("category.page", "create"),
    authorizePermission("category.manager.feature", "access"),
    authorizePermission("category.create.feature", "create"),
    validate(createCategorySchema),
    categoryController.create
)
router.put(
    "/:id",
    authorizePermission("category.page", "update"),
    authorizePermission("category.manager.feature", "access"),
    validate(updateCategorySchema),
    categoryController.update
)
router.delete(
    "/:id",
    authorizePermission("category.page", "delete"),
    authorizePermission("category.manager.feature", "access"),
    authorizePermission("category.delete.feature", "delete"),
    validate(categoryIdParamSchema),
    categoryController.delete
)

export default router
