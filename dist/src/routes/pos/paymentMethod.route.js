"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentMethod_model_1 = require("../../models/pos/paymentMethod.model");
const paymentMethod_service_1 = require("../../services/pos/paymentMethod.service");
const paymentMethod_controller_1 = require("../../controllers/pos/paymentMethod.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const posMaster_schema_1 = require("../../utils/schemas/posMaster.schema");
const router = (0, express_1.Router)();
const paymentMethodModel = new paymentMethod_model_1.PaymentMethodModels();
const paymentMethodService = new paymentMethod_service_1.PaymentMethodService(paymentMethodModel);
const paymentMethodController = new paymentMethod_controller_1.PaymentMethodController(paymentMethodService);
router.use(auth_middleware_1.authenticateToken);
router.use((0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]));
// Authorization:
// Admin manage, Employee read.
router.get("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), paymentMethodController.findAll);
router.get("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), (0, validate_middleware_1.validate)(posMaster_schema_1.paymentMethodIdParamSchema), paymentMethodController.findOne);
router.get("/getByName/:name", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), (0, validate_middleware_1.validate)(posMaster_schema_1.paymentMethodNameParamSchema), paymentMethodController.findByName);
router.post("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), (0, validate_middleware_1.validate)(posMaster_schema_1.createPaymentMethodSchema), paymentMethodController.create);
router.put("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), (0, validate_middleware_1.validate)(posMaster_schema_1.updatePaymentMethodSchema), paymentMethodController.update);
router.delete("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), (0, validate_middleware_1.validate)(posMaster_schema_1.paymentMethodIdParamSchema), paymentMethodController.delete);
exports.default = router;
