import express from "express";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validate.middleware";
import { getPrintSettings, updatePrintSettings } from "../../controllers/pos/printSettings.controller";
import { updatePrintSettingsSchema } from "../../utils/schemas/posMaster.schema";

const router = express.Router();

router.use(authenticateToken);
router.use(requireBranch);

router.get("/", authorizePermission("print_settings.page", "view"), getPrintSettings);
router.put(
    "/",
    authorizePermission("print_settings.page", "update"),
    validate(updatePrintSettingsSchema),
    updatePrintSettings
);

export default router;

