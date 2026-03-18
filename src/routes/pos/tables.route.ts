import { Router } from "express";
import { TablesModels } from "../../models/pos/tables.model";
import { TablesService } from "../../services/pos/tables.service";
import { TablesController } from "../../controllers/pos/tables.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { validate } from "../../middleware/validate.middleware";
import { authorizePermission, authorizeResolvedPermissions } from "../../middleware/permission.middleware";
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

router.get(
    "/",
    authorizeResolvedPermissions((req) => {
        const requirements = [{ resourceKey: "tables.page", actionKey: "view" }];
        const hasSearch = typeof req.query.q === "string" && req.query.q.trim().length > 0;
        const hasFilter =
            (typeof req.query.status === "string" && req.query.status.trim().length > 0 && req.query.status !== "all") ||
            (typeof req.query.table_state === "string" && req.query.table_state.trim().length > 0 && req.query.table_state !== "all") ||
            (typeof req.query.sort_created === "string" && req.query.sort_created.trim().length > 0);

        if (hasSearch) {
            requirements.push({ resourceKey: "tables.search.feature", actionKey: "view" });
        }
        if (hasFilter) {
            requirements.push({ resourceKey: "tables.filter.feature", actionKey: "view" });
        }

        return requirements;
    }),
    validate(paginationQuerySchema),
    tablesController.findAll
);
router.get("/qr-codes", authorizePermission("qr_code.page", "view"), validate(paginationQuerySchema), tablesController.findAllQrCodes);
router.get(
    "/getByName/:name",
    authorizePermission("tables.manager.feature", "access"),
    validate(tableNameParamSchema),
    tablesController.findByName
);
router.get("/:id", authorizePermission("tables.page", "view"), validate(tableIdParamSchema), tablesController.findOne);
router.get("/:id/qr", authorizePermission("qr_code.preview.feature", "view"), validate(tableIdParamSchema), tablesController.getQrToken);
router.post("/:id/qr/rotate", authorizePermission("qr_code.rotate.feature", "update"), validate(tableIdParamSchema), tablesController.rotateQrToken);

router.post(
    "/",
    authorizePermission("tables.page", "create"),
    authorizePermission("tables.manager.feature", "access"),
    authorizePermission("tables.create.feature", "create"),
    validate(createTableSchema),
    tablesController.create
);
router.put(
    "/:id",
    authorizeResolvedPermissions((req) => {
        const requirements = [
            { resourceKey: "tables.page", actionKey: "update" },
            { resourceKey: "tables.manager.feature", actionKey: "access" },
        ];
        const hasDetailUpdate =
            Object.prototype.hasOwnProperty.call(req.body ?? {}, "table_name") ||
            Object.prototype.hasOwnProperty.call(req.body ?? {}, "status");
        const hasStatusUpdate = Object.prototype.hasOwnProperty.call(req.body ?? {}, "is_active");

        if (hasDetailUpdate) {
            requirements.push({ resourceKey: "tables.edit.feature", actionKey: "update" });
        }

        if (hasStatusUpdate) {
            requirements.push({ resourceKey: "tables.status.feature", actionKey: "update" });
        }

        if (!hasDetailUpdate && !hasStatusUpdate) {
            requirements.push({ resourceKey: "tables.edit.feature", actionKey: "update" });
        }

        return requirements;
    }),
    validate(updateTableSchema),
    tablesController.update
);
router.delete(
    "/:id",
    authorizePermission("tables.page", "delete"),
    authorizePermission("tables.manager.feature", "access"),
    authorizePermission("tables.delete.feature", "delete"),
    validate(tableIdParamSchema),
    tablesController.delete
);

export default router;
