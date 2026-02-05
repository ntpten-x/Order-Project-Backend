import { Router } from "express";
import { AuditController } from "../controllers/audit.controller";
import { authenticateToken, authorizeRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { auditIdParamSchema, auditQuerySchema } from "../utils/schemas/audit.schema";

const router = Router();
const controller = new AuditController();

router.get(
    "/logs",
    authenticateToken,
    authorizeRole(["Admin"]),
    validate(auditQuerySchema),
    controller.getLogs
);

router.get(
    "/logs/:id",
    authenticateToken,
    authorizeRole(["Admin"]),
    validate(auditIdParamSchema),
    controller.getById
);

export default router;
