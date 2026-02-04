import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticateToken, authorizeRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { loginSchema, switchBranchSchema } from "../utils/schemas/auth.schema";

const router = Router();

router.post("/login", validate(loginSchema), AuthController.login);
router.post("/logout", AuthController.logout);
router.get("/me", authenticateToken, AuthController.getMe);
router.post("/switch-branch", authenticateToken, authorizeRole(["Admin"]), validate(switchBranchSchema), AuthController.switchBranch);

export default router;
