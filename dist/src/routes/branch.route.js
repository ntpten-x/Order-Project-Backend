"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const branch_controller_1 = require("../controllers/branch.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const branch_schema_1 = require("../utils/schemas/branch.schema");
const branchRouter = (0, express_1.Router)();
const branchController = new branch_controller_1.BranchController();
// Protect all branch routes
branchRouter.use(auth_middleware_1.authenticateToken);
// Get all branches (Admin, Manager)
branchRouter.get("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), branchController.getAll);
// Get one branch
branchRouter.get("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), (0, validate_middleware_1.validate)(branch_schema_1.branchIdParamSchema), branchController.getOne);
// Create branch (Admin only)
branchRouter.post("/", (0, auth_middleware_1.authorizeRole)(["Admin"]), (0, validate_middleware_1.validate)(branch_schema_1.createBranchSchema), branchController.create);
// Update branch (Admin only)
branchRouter.put("/:id", (0, auth_middleware_1.authorizeRole)(["Admin"]), (0, validate_middleware_1.validate)(branch_schema_1.updateBranchSchema), branchController.update);
// Delete branch (Admin only)
branchRouter.delete("/:id", (0, auth_middleware_1.authorizeRole)(["Admin"]), (0, validate_middleware_1.validate)(branch_schema_1.branchIdParamSchema), branchController.delete);
exports.default = branchRouter;
