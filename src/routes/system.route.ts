import { Router } from "express";
import { authenticateToken, authorizeRole } from "../middleware/auth.middleware";
import { SystemHealthController } from "../controllers/systemHealth.controller";

const router = Router();
const controller = new SystemHealthController();

router.get("/health", authenticateToken, authorizeRole(["Admin"]), controller.getHealth);

export default router;
