import { Router } from "express";
import { BranchController } from "../controllers/branch.controller";
import { authenticateToken, authorizeRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { branchIdParamSchema, createBranchSchema, updateBranchSchema } from "../utils/schemas/branch.schema";

const branchRouter = Router();
const branchController = new BranchController();

// Protect all branch routes
branchRouter.use(authenticateToken);

// Get all branches (Admin, Manager)
branchRouter.get("/", authorizeRole(["Admin", "Manager"]), branchController.getAll);

// Get one branch
branchRouter.get("/:id", authorizeRole(["Admin", "Manager"]), validate(branchIdParamSchema), branchController.getOne);

// Create branch (Admin only)
branchRouter.post("/", authorizeRole(["Admin"]), validate(createBranchSchema), branchController.create);

// Update branch (Admin only)
branchRouter.put("/:id", authorizeRole(["Admin"]), validate(updateBranchSchema), branchController.update);

// Delete branch (Admin only)
branchRouter.delete("/:id", authorizeRole(["Admin"]), validate(branchIdParamSchema), branchController.delete);

export default branchRouter;
