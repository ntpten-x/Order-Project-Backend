"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payments_model_1 = require("../../models/pos/payments.model");
const payments_service_1 = require("../../services/pos/payments.service");
const payments_controller_1 = require("../../controllers/pos/payments.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const payments_schema_1 = require("../../utils/schemas/payments.schema");
const router = (0, express_1.Router)();
const paymentsModel = new payments_model_1.PaymentsModels();
const paymentsService = new payments_service_1.PaymentsService(paymentsModel);
const paymentsController = new payments_controller_1.PaymentsController(paymentsService);
router.use(auth_middleware_1.authenticateToken);
router.use((0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]));
// Authorization: 
// Admin/Manager manage, Employee usually creates payments.
// Allowing Employee to Create/Read/Update (if needed) but maybe restrict Delete to Admin/Manager?
// For now, consistent with other modules: Admin/Manager manage, Employee read + create (as they take orders).
router.get("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), paymentsController.findAll);
router.get("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), (0, validate_middleware_1.validate)(payments_schema_1.paymentIdParamSchema), paymentsController.findOne);
router.post("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), (0, validate_middleware_1.validate)(payments_schema_1.createPaymentSchema), paymentsController.create);
router.put("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), (0, validate_middleware_1.validate)(payments_schema_1.updatePaymentSchema), paymentsController.update);
router.delete("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), (0, validate_middleware_1.validate)(payments_schema_1.paymentIdParamSchema), paymentsController.delete);
exports.default = router;
