import { RolesController } from "../controllers/roles.controller"
import { RolesService } from "../services/roles.service"
import { RolesModels } from "../models/roles.model"
import { Router } from "express"
import { authenticateToken, authorizeRole } from "../middleware/auth.middleware"

const router = Router()

const rolesModel = new RolesModels()
const rolesService = new RolesService(rolesModel)
const rolesController = new RolesController(rolesService)

// Protect all routes
router.use(authenticateToken)
router.use(authorizeRole(["Admin"]))

router.get("/", rolesController.findAll)
router.get("/:id", rolesController.findOne)
router.post("/", rolesController.create)
router.put("/:id", rolesController.update)
router.delete("/:id", rolesController.delete)

export default router