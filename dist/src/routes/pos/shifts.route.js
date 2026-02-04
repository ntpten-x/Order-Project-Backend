"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const shifts_controller_1 = require("../../controllers/pos/shifts.controller");
const shifts_service_1 = require("../../services/pos/shifts.service");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const branch_middleware_1 = require("../../middleware/branch.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const posMaster_schema_1 = require("../../utils/schemas/posMaster.schema");
const shiftsRouter = (0, express_1.Router)();
const shiftsService = new shifts_service_1.ShiftsService();
const shiftsController = new shifts_controller_1.ShiftsController(shiftsService);
// All shift routes require authentication
shiftsRouter.post("/open", auth_middleware_1.authenticateToken, branch_middleware_1.requireBranch, (0, validate_middleware_1.validate)(posMaster_schema_1.openShiftSchema), shiftsController.openShift);
shiftsRouter.post("/close", auth_middleware_1.authenticateToken, branch_middleware_1.requireBranch, (0, validate_middleware_1.validate)(posMaster_schema_1.closeShiftSchema), shiftsController.closeShift);
shiftsRouter.get("/current", auth_middleware_1.authenticateToken, branch_middleware_1.requireBranch, shiftsController.getCurrentShift);
shiftsRouter.get("/current/summary", auth_middleware_1.authenticateToken, branch_middleware_1.requireBranch, shiftsController.getCurrentSummary);
shiftsRouter.get("/summary/:id", auth_middleware_1.authenticateToken, branch_middleware_1.requireBranch, (0, validate_middleware_1.validate)(posMaster_schema_1.shiftSummaryIdParamSchema), shiftsController.getSummary);
exports.default = shiftsRouter;
