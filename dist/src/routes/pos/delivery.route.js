"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const delivery_model_1 = require("../../models/pos/delivery.model");
const delivery_service_1 = require("../../services/pos/delivery.service");
const delivery_controller_1 = require("../../controllers/pos/delivery.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
const deliveryModel = new delivery_model_1.DeliveryModels();
const deliveryService = new delivery_service_1.DeliveryService(deliveryModel);
const deliveryController = new delivery_controller_1.DeliveryController(deliveryService);
router.use(auth_middleware_1.authenticateToken);
// Authorization: 
// Admin/Manager can Manage
// Employee can View
router.get("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), deliveryController.findAll);
router.get("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), deliveryController.findOne);
router.get("/getByName/:name", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), deliveryController.findByName);
router.post("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), deliveryController.create);
router.put("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), deliveryController.update);
router.delete("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), deliveryController.delete);
exports.default = router;
