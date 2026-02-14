import { Router } from "express";
import { UsersController } from "../controllers/users.controller";
import { UsersService } from "../services/users.service";
import { UsersModels } from "../models/users.model";
import { authenticateToken } from "../middleware/auth.middleware";
import { enforceUserManagementPolicy } from "../middleware/userManagement.middleware";
import { authorizePermission, enforceUserTargetScope } from "../middleware/permission.middleware";
import { validate } from "../middleware/validate.middleware";
import { paginationQuerySchema } from "../utils/schemas/common.schema";
import { createUserSchema, updateUserSchema } from "../utils/schemas/users.schema";

const router = Router()

const usersModel = new UsersModels()
const usersService = new UsersService(usersModel)
const usersController = new UsersController(usersService)

// Protect all routes
router.use(authenticateToken)
router.use(enforceUserManagementPolicy)

router.get("/", authorizePermission("users.page", "view"), validate(paginationQuerySchema), usersController.findAll)
router.get("/:id", authorizePermission("users.page", "view"), enforceUserTargetScope("id"), usersController.findOne)
router.post("/", authorizePermission("users.page", "create"), validate(createUserSchema), usersController.create)
router.put("/:id", authorizePermission("users.page", "update"), enforceUserTargetScope("id"), validate(updateUserSchema), usersController.update)
router.delete("/:id", authorizePermission("users.page", "delete"), enforceUserTargetScope("id"), usersController.delete)

export default router
