import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validate.middleware";
import { StockCategoryController } from "../../controllers/stock/category.controller";
import { StockCategoryModel } from "../../models/stock/category.model";
import { StockCategoryService } from "../../services/stock/category.service";
import { paginationQuerySchema } from "../../utils/schemas/common.schema";
import {
    createStockCategorySchema,
    stockCategoryIdParamSchema,
    stockCategoryNameParamSchema,
    updateStockCategorySchema,
} from "../../utils/schemas/stock.schema";

const router = Router();

const stockCategoryModel = new StockCategoryModel();
const stockCategoryService = new StockCategoryService(stockCategoryModel);
const stockCategoryController = new StockCategoryController(stockCategoryService);

router.use(authenticateToken);
router.use(requireBranch);

router.get("/", authorizePermission("stock.category.page", "view"), validate(paginationQuerySchema), stockCategoryController.findAll);
router.get("/name/:name", authorizePermission("stock.category.page", "view"), validate(stockCategoryNameParamSchema), stockCategoryController.findOneByName);
router.get("/:id", authorizePermission("stock.category.page", "view"), validate(stockCategoryIdParamSchema), stockCategoryController.findOne);
router.post("/", authorizePermission("stock.category.page", "create"), validate(createStockCategorySchema), stockCategoryController.create);
router.put("/:id", authorizePermission("stock.category.page", "update"), validate(updateStockCategorySchema), stockCategoryController.update);
router.delete("/:id", authorizePermission("stock.category.page", "delete"), validate(stockCategoryIdParamSchema), stockCategoryController.delete);

export default router;
