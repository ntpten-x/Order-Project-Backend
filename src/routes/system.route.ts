import { Router } from "express";
import { authenticateToken } from "../middleware/auth.middleware";
import { authorizePermission } from "../middleware/permission.middleware";
import { SystemHealthController } from "../controllers/systemHealth.controller";
import { validate } from "../middleware/validate.middleware";
import { systemHealthQuerySchema } from "../utils/schemas/systemHealth.schema";

const router = Router();
const controller = new SystemHealthController();

router.get(
    "/health",
    authenticateToken,
    authorizePermission("health_system.page", "view"),
    validate(systemHealthQuerySchema),
    controller.getHealth
);

export default router;
