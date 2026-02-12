import { Router } from "express";
import { AuditController } from "../controllers/audit.controller";
import { authenticateToken } from "../middleware/auth.middleware";
import { authorizePermission } from "../middleware/permission.middleware";
import { validate } from "../middleware/validate.middleware";
import { auditIdParamSchema, auditQuerySchema } from "../utils/schemas/audit.schema";

const router = Router();
const controller = new AuditController();

router.get(
    "/logs",
    authenticateToken,
    authorizePermission("audit.page", "view"),
    validate(auditQuerySchema),
    controller.getLogs
);

router.get(
    "/logs/:id",
    authenticateToken,
    authorizePermission("audit.page", "view"),
    validate(auditIdParamSchema),
    controller.getById
);

export default router;
