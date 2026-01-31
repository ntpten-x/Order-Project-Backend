"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tables_model_1 = require("../../models/pos/tables.model");
const tables_service_1 = require("../../services/pos/tables.service");
const tables_controller_1 = require("../../controllers/pos/tables.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const common_schema_1 = require("../../utils/schemas/common.schema");
const posMaster_schema_1 = require("../../utils/schemas/posMaster.schema");
const router = (0, express_1.Router)();
const tablesModel = new tables_model_1.TablesModels();
const tablesService = new tables_service_1.TablesService(tablesModel);
const tablesController = new tables_controller_1.TablesController(tablesService);
router.use(auth_middleware_1.authenticateToken);
router.use((0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]));
// Authorization: Assuming all authenticated users can view/update status, 
// but creation/deletion might be restricted. 
// For now, I will follow the pattern in products.route.ts
// Employee can view, Admin/Manager can manage.
// Actually, Waiters need to update table status, so they need update rights.
router.get("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), (0, validate_middleware_1.validate)(common_schema_1.paginationQuerySchema), tablesController.findAll);
router.get("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), (0, validate_middleware_1.validate)(posMaster_schema_1.tableIdParamSchema), tablesController.findOne);
router.get("/getByName/:name", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), (0, validate_middleware_1.validate)(posMaster_schema_1.tableNameParamSchema), tablesController.findByName);
router.post("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), (0, validate_middleware_1.validate)(posMaster_schema_1.createTableSchema), tablesController.create);
router.put("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), (0, validate_middleware_1.validate)(posMaster_schema_1.updateTableSchema), tablesController.update); // Employee can update status
router.delete("/:id", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), (0, validate_middleware_1.validate)(posMaster_schema_1.tableIdParamSchema), tablesController.delete);
exports.default = router;
