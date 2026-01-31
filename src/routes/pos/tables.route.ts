import { Router } from "express";
import { TablesModels } from "../../models/pos/tables.model";
import { TablesService } from "../../services/pos/tables.service";
import { TablesController } from "../../controllers/pos/tables.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { paginationQuerySchema } from "../../utils/schemas/common.schema";
import {
    createTableSchema,
    tableIdParamSchema,
    tableNameParamSchema,
    updateTableSchema
} from "../../utils/schemas/posMaster.schema";

const router = Router()

const tablesModel = new TablesModels()
const tablesService = new TablesService(tablesModel)
const tablesController = new TablesController(tablesService)

router.use(authenticateToken)
router.use(authorizeRole(["Admin", "Manager", "Employee"]))
// Authorization: Assuming all authenticated users can view/update status, 
// but creation/deletion might be restricted. 
// For now, I will follow the pattern in products.route.ts
// Employee can view, Admin/Manager can manage.
// Actually, Waiters need to update table status, so they need update rights.

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), validate(paginationQuerySchema), tablesController.findAll)
router.get("/:id", authorizeRole(["Admin", "Manager", "Employee"]), validate(tableIdParamSchema), tablesController.findOne)
router.get("/getByName/:name", authorizeRole(["Admin", "Manager", "Employee"]), validate(tableNameParamSchema), tablesController.findByName)

router.post("/", authorizeRole(["Admin", "Manager"]), validate(createTableSchema), tablesController.create)
router.put("/:id", authorizeRole(["Admin", "Manager", "Employee"]), validate(updateTableSchema), tablesController.update) // Employee can update status
router.delete("/:id", authorizeRole(["Admin", "Manager"]), validate(tableIdParamSchema), tablesController.delete)

export default router
