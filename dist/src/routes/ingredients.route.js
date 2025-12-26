"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ingredients_model_1 = require("../models/ingredients.model");
const ingredients_service_1 = require("../services/ingredients.service");
const ingredients_controller_1 = require("../controllers/ingredients.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const ingredientsModel = new ingredients_model_1.IngredientsModel();
const ingredientsService = new ingredients_service_1.IngredientsService(ingredientsModel);
const ingredientsController = new ingredients_controller_1.IngredientsController(ingredientsService);
// Protect all routes
router.use(auth_middleware_1.authenticateToken);
router.use((0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]));
// Public-ish routes (All authenticated roles)
router.get("/", ingredientsController.findAll);
router.get("/:id", ingredientsController.findOne);
router.get("/name/:ingredient_name", ingredientsController.findOneByName);
// Admin only routes for management
router.post("/", (0, auth_middleware_1.authorizeRole)(["Admin"]), ingredientsController.create);
router.put("/:id", (0, auth_middleware_1.authorizeRole)(["Admin"]), ingredientsController.update);
router.delete("/:id", (0, auth_middleware_1.authorizeRole)(["Admin"]), ingredientsController.delete);
exports.default = router;
