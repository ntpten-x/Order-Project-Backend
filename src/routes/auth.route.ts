import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

router.post("/login", AuthController.login);
router.post("/logout", AuthController.logout);
router.get("/me", authenticateToken, AuthController.getMe);

export default router;
