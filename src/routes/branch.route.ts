import { Router } from "express";
import { BranchController } from "../controllers/branch.controller";
import { authenticateToken, authorizeRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { authorizePermission, enforceBranchTargetScope } from "../middleware/permission.middleware";
import { paginationQuerySchema } from "../utils/schemas/common.schema";
import { branchIdParamSchema, createBranchSchema, updateBranchSchema } from "../utils/schemas/branch.schema";

const branchRouter = Router();
const branchController = new BranchController();

// Protect all branch routes
branchRouter.use(authenticateToken);

// Get all branches (Admin, Manager)
branchRouter.get("/", authorizePermission("branches.page", "view"), validate(paginationQuerySchema), branchController.getAll);

// Get one branch
branchRouter.get("/:id", authorizePermission("branches.page", "view"), enforceBranchTargetScope("id"), validate(branchIdParamSchema), branchController.getOne);

// Create branch (Admin only)
branchRouter.post(
    "/",
    authorizeRole(["Admin"]),
    authorizePermission("branches.page", "create"),
    validate(createBranchSchema),
    branchController.create
);

// Update branch (Admin only)
branchRouter.put(
    "/:id",
    authorizeRole(["Admin"]),
    authorizePermission("branches.page", "update"),
    enforceBranchTargetScope("id"),
    validate(updateBranchSchema),
    branchController.update
);

// Delete branch (Admin only)
branchRouter.delete(
    "/:id",
    authorizeRole(["Admin"]),
    authorizePermission("branches.page", "delete"),
    enforceBranchTargetScope("id"),
    validate(branchIdParamSchema),
    branchController.delete
);

export default branchRouter;
