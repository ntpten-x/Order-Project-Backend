"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const discounts_model_1 = require("../../models/pos/discounts.model");
const discounts_service_1 = require("../../services/pos/discounts.service");
const discounts_controller_1 = require("../../controllers/pos/discounts.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
const discountsModel = new discounts_model_1.DiscountsModels();
const discountsService = new discounts_service_1.DiscountsService(discountsModel);
const discountsController = new discounts_controller_1.DiscountsController(discountsService);
router.use(auth_middleware_1.authenticateToken);
// Authorization:
// Admin/Manager can Manage
// Employee can Read
router.get("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), discountsController.findAll);
router.get("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), discountsController.findOne);
router.get("/getByName/:name", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), discountsController.findByName);
router.post("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), discountsController.create);
router.put("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), discountsController.update);
router.delete("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), discountsController.delete);
exports.default = router;
