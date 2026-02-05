import { Router } from "express";
import { UsersController } from "../controllers/users.controller";
import { UsersService } from "../services/users.service";
import { UsersModels } from "../models/users.model";
import { authenticateToken, authorizeRole } from "../middleware/auth.middleware";
import { enforceUserManagementPolicy } from "../middleware/userManagement.middleware";
import { validate } from "../middleware/validate.middleware";
import { createUserSchema, updateUserSchema } from "../utils/schemas/users.schema";

const router = Router()

const usersModel = new UsersModels()
const usersService = new UsersService(usersModel)
const usersController = new UsersController(usersService)

// Protect all routes
router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager"]))
router.use(enforceUserManagementPolicy)

router.get("/", usersController.findAll)
router.get("/:id", usersController.findOne)
router.post("/", validate(createUserSchema), usersController.create)
router.put("/:id", validate(updateUserSchema), usersController.update)
router.delete("/:id", usersController.delete)

export default router
