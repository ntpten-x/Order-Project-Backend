import { RolesController } from "../controllers/roles.controller"
import { RolesService } from "../services/roles.service"
import { RolesModels } from "../models/roles.model"
import { Router } from "express"
import { authenticateToken, authorizeRole } from "../middleware/auth.middleware"
import { validate } from "../middleware/validate.middleware"
import { createRoleSchema, roleIdParamSchema, updateRoleSchema } from "../utils/schemas/roles.schema"

const router = Router()

const rolesModel = new RolesModels()
const rolesService = new RolesService(rolesModel)
const rolesController = new RolesController(rolesService)

// Protect all routes
router.use(authenticateToken)
router.use(authorizeRole(["Admin"]))

router.get("/", rolesController.findAll)
router.get("/:id", validate(roleIdParamSchema), rolesController.findOne)
router.post("/", validate(createRoleSchema), rolesController.create)
router.put("/:id", validate(updateRoleSchema), rolesController.update)
router.delete("/:id", validate(roleIdParamSchema), rolesController.delete)

export default router
