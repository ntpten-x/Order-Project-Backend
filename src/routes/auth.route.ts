import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { authorizePermission } from "../middleware/permission.middleware";
import { loginSchema, switchBranchSchema, updateMeSchema } from "../utils/schemas/auth.schema";

const router = Router();

router.post("/login", validate(loginSchema), AuthController.login);
router.post("/logout", AuthController.logout);
router.get("/me", authenticateToken, AuthController.getMe);
router.put("/me", authenticateToken, validate(updateMeSchema), AuthController.updateMe);
router.post(
    "/switch-branch",
    authenticateToken,
    authorizePermission("branches.page", "update"),
    validate(switchBranchSchema),
    AuthController.switchBranch
);

export default router;
