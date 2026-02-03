import express from "express";
import { getShopProfile, updateShopProfile } from "../../controllers/pos/shopProfile.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { updateShopProfileSchema } from "../../utils/schemas/posMaster.schema";

const router = express.Router();

router.use(authenticateToken);

router.get("/", authorizeRole(["Admin", "Manager", "Employee"]), getShopProfile);
router.put("/", authorizeRole(["Admin", "Manager"]), validate(updateShopProfileSchema), updateShopProfile);
router.post("/", authorizeRole(["Admin", "Manager"]), validate(updateShopProfileSchema), updateShopProfile); // Allow POST as update too

export default router;
