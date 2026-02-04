"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ingredients_model_1 = require("../../models/stock/ingredients.model");
const ingredients_service_1 = require("../../services/stock/ingredients.service");
const ingredients_controller_1 = require("../../controllers/stock/ingredients.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const branch_middleware_1 = require("../../middleware/branch.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const stock_schema_1 = require("../../utils/schemas/stock.schema");
const router = (0, express_1.Router)();
const ingredientsModel = new ingredients_model_1.IngredientsModel();
const ingredientsService = new ingredients_service_1.IngredientsService(ingredientsModel);
const ingredientsController = new ingredients_controller_1.IngredientsController(ingredientsService);
// Protect all routes
router.use(auth_middleware_1.authenticateToken);
router.use((0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]));
router.use(branch_middleware_1.requireBranch);
// Public-ish routes (All authenticated roles)
router.get("/", ingredientsController.findAll);
router.get("/:id", (0, validate_middleware_1.validate)(stock_schema_1.ingredientIdParamSchema), ingredientsController.findOne);
router.get("/name/:ingredient_name", (0, validate_middleware_1.validate)(stock_schema_1.ingredientNameParamSchema), ingredientsController.findOneByName);
// Admin only routes for management
router.post("/", (0, auth_middleware_1.authorizeRole)(["Admin"]), (0, validate_middleware_1.validate)(stock_schema_1.createIngredientSchema), ingredientsController.create);
router.put("/:id", (0, auth_middleware_1.authorizeRole)(["Admin"]), (0, validate_middleware_1.validate)(stock_schema_1.updateIngredientSchema), ingredientsController.update);
router.delete("/:id", (0, auth_middleware_1.authorizeRole)(["Admin"]), (0, validate_middleware_1.validate)(stock_schema_1.ingredientIdParamSchema), ingredientsController.delete);
exports.default = router;
