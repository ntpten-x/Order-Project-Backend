import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { loginSchema } from "../utils/schemas/auth.schema";

const router = Router();

router.post("/login", validate(loginSchema), AuthController.login);
router.post("/logout", AuthController.logout);
router.get("/me", authenticateToken, AuthController.getMe);

export default router;
