import { Router } from "express";
import { UsersController } from "../controllers/users.controller";
import { UsersService } from "../services/users.service";
import { UsersModels } from "../models/users.model";
import { authenticateToken, authorizeRole } from "../middleware/auth.middleware";

const router = Router()

const usersModel = new UsersModels()
const usersService = new UsersService(usersModel)
const usersController = new UsersController(usersService)

// Protect all routes
router.use(authenticateToken)
router.use(authorizeRole(["Admin"]))

router.get("/", usersController.findAll)
router.get("/:id", usersController.findOne)
router.post("/", usersController.create)
router.put("/:id", usersController.update)
router.delete("/:id", usersController.delete)

export default router