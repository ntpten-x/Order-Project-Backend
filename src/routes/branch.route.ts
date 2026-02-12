import { Router } from "express";
import { BranchController } from "../controllers/branch.controller";
import { authenticateToken } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { authorizePermission } from "../middleware/permission.middleware";
import { branchIdParamSchema, createBranchSchema, updateBranchSchema } from "../utils/schemas/branch.schema";

const branchRouter = Router();
const branchController = new BranchController();

// Protect all branch routes
branchRouter.use(authenticateToken);

// Get all branches (Admin, Manager)
branchRouter.get("/", authorizePermission("branches.page", "view"), branchController.getAll);

// Get one branch
branchRouter.get("/:id", authorizePermission("branches.page", "view"), validate(branchIdParamSchema), branchController.getOne);

// Create branch (Admin only)
branchRouter.post("/", authorizePermission("branches.page", "create"), validate(createBranchSchema), branchController.create);

// Update branch (Admin only)
branchRouter.put("/:id", authorizePermission("branches.page", "update"), validate(updateBranchSchema), branchController.update);

// Delete branch (Admin only)
branchRouter.delete("/:id", authorizePermission("branches.page", "delete"), validate(branchIdParamSchema), branchController.delete);

export default branchRouter;
