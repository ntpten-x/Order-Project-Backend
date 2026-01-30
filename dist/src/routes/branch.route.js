"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const branch_controller_1 = require("../controllers/branch.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const branchRouter = (0, express_1.Router)();
const branchController = new branch_controller_1.BranchController();
// Protect all branch routes
branchRouter.use(auth_middleware_1.authenticateToken);
// Get all branches (Admin, Manager)
branchRouter.get("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), branchController.getAll);
// Get one branch
branchRouter.get("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), branchController.getOne);
// Create branch (Admin only)
branchRouter.post("/", (0, auth_middleware_1.authorizeRole)(["Admin"]), branchController.create);
// Update branch (Admin only)
branchRouter.put("/:id", (0, auth_middleware_1.authorizeRole)(["Admin"]), branchController.update);
// Delete branch (Admin only)
branchRouter.delete("/:id", (0, auth_middleware_1.authorizeRole)(["Admin"]), branchController.delete);
exports.default = branchRouter;
