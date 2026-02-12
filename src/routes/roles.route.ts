import { RolesController } from "../controllers/roles.controller"
import { RolesService } from "../services/roles.service"
import { RolesModels } from "../models/roles.model"
import { Router } from "express"
import { authenticateToken } from "../middleware/auth.middleware"
import { authorizePermission } from "../middleware/permission.middleware"
import { validate } from "../middleware/validate.middleware"
import { createRoleSchema, roleIdParamSchema, updateRoleSchema } from "../utils/schemas/roles.schema"

const router = Router()

const rolesModel = new RolesModels()
const rolesService = new RolesService(rolesModel)
const rolesController = new RolesController(rolesService)

// Protect all routes
router.use(authenticateToken)

router.get("/", authorizePermission("roles.page", "view"), rolesController.findAll)
router.get("/:id", authorizePermission("roles.page", "view"), validate(roleIdParamSchema), rolesController.findOne)
router.post("/", authorizePermission("roles.page", "create"), validate(createRoleSchema), rolesController.create)
router.put("/:id", authorizePermission("roles.page", "update"), validate(updateRoleSchema), rolesController.update)
router.delete("/:id", authorizePermission("roles.page", "delete"), validate(roleIdParamSchema), rolesController.delete)

export default router
