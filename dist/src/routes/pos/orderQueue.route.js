"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orderQueue_controller_1 = require("../../controllers/pos/orderQueue.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const branch_middleware_1 = require("../../middleware/branch.middleware");
const router = (0, express_1.Router)();
const orderQueueController = new orderQueue_controller_1.OrderQueueController();
// Protect all routes
router.use(auth_middleware_1.authenticateToken);
router.use((0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]));
router.use(branch_middleware_1.requireBranch);
// Routes
router.post("/", orderQueueController.addToQueue);
router.get("/", orderQueueController.getQueue);
router.patch("/:id/status", orderQueueController.updateStatus);
router.delete("/:id", orderQueueController.removeFromQueue);
router.post("/reorder", orderQueueController.reorderQueue);
exports.default = router;
