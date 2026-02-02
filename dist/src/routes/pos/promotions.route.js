"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const promotions_controller_1 = require("../../controllers/pos/promotions.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
const promotionsController = new promotions_controller_1.PromotionsController();
// Protect all routes
router.use(auth_middleware_1.authenticateToken);
// Public routes (for validation and viewing)
router.post("/validate", promotionsController.validatePromotion);
router.get("/active", promotionsController.getActivePromotions);
router.get("/", promotionsController.getAll);
router.get("/getById/:id", promotionsController.getById);
// Protected routes (for applying promotions)
router.use((0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]));
router.post("/apply", promotionsController.applyPromotion);
// Admin only routes (for CRUD operations)
router.use((0, auth_middleware_1.authorizeRole)(["Admin"]));
router.post("/create", promotionsController.create);
router.put("/update/:id", promotionsController.update);
router.delete("/delete/:id", promotionsController.delete);
exports.default = router;
