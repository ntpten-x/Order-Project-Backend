"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const discounts_model_1 = require("../../models/pos/discounts.model");
const discounts_service_1 = require("../../services/pos/discounts.service");
const discounts_controller_1 = require("../../controllers/pos/discounts.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const branch_middleware_1 = require("../../middleware/branch.middleware");
const posMaster_schema_1 = require("../../utils/schemas/posMaster.schema");
const router = (0, express_1.Router)();
const discountsModel = new discounts_model_1.DiscountsModels();
const discountsService = new discounts_service_1.DiscountsService(discountsModel);
const discountsController = new discounts_controller_1.DiscountsController(discountsService);
router.use(auth_middleware_1.authenticateToken);
router.use((0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]));
router.use(branch_middleware_1.requireBranch);
// Authorization:
// Admin/Manager can Manage
// Employee can Read
router.get("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), discountsController.findAll);
router.get("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), (0, validate_middleware_1.validate)(posMaster_schema_1.discountIdParamSchema), discountsController.findOne);
router.get("/getByName/:name", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), (0, validate_middleware_1.validate)(posMaster_schema_1.discountNameParamSchema), discountsController.findByName);
router.post("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), (0, validate_middleware_1.validate)(posMaster_schema_1.createDiscountSchema), discountsController.create);
router.put("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), (0, validate_middleware_1.validate)(posMaster_schema_1.updateDiscountSchema), discountsController.update);
router.delete("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), (0, validate_middleware_1.validate)(posMaster_schema_1.discountIdParamSchema), discountsController.delete);
exports.default = router;
