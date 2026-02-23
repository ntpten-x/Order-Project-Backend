import { Router } from "express";
import { TablesModels } from "../../models/pos/tables.model";
import { TablesService } from "../../services/pos/tables.service";
import { TablesController } from "../../controllers/pos/tables.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { validate } from "../../middleware/validate.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
import { paginationQuerySchema } from "../../utils/schemas/common.schema";
import {
    createTableSchema,
    tableIdParamSchema,
    tableNameParamSchema,
    updateTableSchema,
} from "../../utils/schemas/posMaster.schema";

const router = Router();

const tablesModel = new TablesModels();
const tablesService = new TablesService(tablesModel);
const tablesController = new TablesController(tablesService);

router.use(authenticateToken);
router.use(requireBranch);

router.get("/", authorizePermission("tables.page", "view"), validate(paginationQuerySchema), tablesController.findAll);
router.get("/getByName/:name", authorizePermission("tables.page", "view"), validate(tableNameParamSchema), tablesController.findByName);
router.get("/:id", authorizePermission("tables.page", "view"), validate(tableIdParamSchema), tablesController.findOne);
router.get("/:id/qr", authorizePermission("tables.page", "view"), validate(tableIdParamSchema), tablesController.getQrToken);
router.post("/:id/qr/rotate", authorizePermission("tables.page", "update"), validate(tableIdParamSchema), tablesController.rotateQrToken);

router.post("/", authorizePermission("tables.page", "create"), validate(createTableSchema), tablesController.create);
router.put("/:id", authorizePermission("tables.page", "update"), validate(updateTableSchema), tablesController.update);
router.delete("/:id", authorizePermission("tables.page", "delete"), validate(tableIdParamSchema), tablesController.delete);

export default router;
