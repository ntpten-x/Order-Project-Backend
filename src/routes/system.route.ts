import { Router } from "express";
import { authenticateToken } from "../middleware/auth.middleware";
import { authorizePermission } from "../middleware/permission.middleware";
import { SystemHealthController } from "../controllers/systemHealth.controller";

const router = Router();
const controller = new SystemHealthController();

router.get("/health", authenticateToken, authorizePermission("health_system.page", "view"), controller.getHealth);

export default router;
