import express from "express";
import { getShopProfile, updateShopProfile } from "../../controllers/pos/shopProfile.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { updateShopProfileSchema } from "../../utils/schemas/posMaster.schema";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";

const router = express.Router();

router.use(authenticateToken);
router.use(requireBranch);

router.get("/", authorizePermission("shop_profile.page", "view"), getShopProfile);
router.put("/", authorizePermission("shop_profile.page", "update"), validate(updateShopProfileSchema), updateShopProfile);
router.post("/", authorizePermission("shop_profile.page", "update"), validate(updateShopProfileSchema), updateShopProfile); // Allow POST as update too

export default router;
