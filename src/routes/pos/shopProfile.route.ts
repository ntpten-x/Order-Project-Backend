import express from "express";
import { getShopProfile, updateShopProfile } from "../../controllers/pos/shopProfile.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { updateShopProfileSchema } from "../../utils/schemas/posMaster.schema";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission, authorizeResolvedPermissions } from "../../middleware/permission.middleware";

const router = express.Router();

router.use(authenticateToken);
router.use(requireBranch);

const resolveProfileUpdatePermissions = (body: Record<string, unknown>) => {
    const requirements: Array<{ resourceKey: string; actionKey: string }> = [];
    const hasIdentityUpdate = Object.prototype.hasOwnProperty.call(body, "shop_name");
    const hasContactUpdate =
        Object.prototype.hasOwnProperty.call(body, "address") ||
        Object.prototype.hasOwnProperty.call(body, "phone");
    const hasPaymentProfileUpdate =
        Object.prototype.hasOwnProperty.call(body, "promptpay_number") ||
        Object.prototype.hasOwnProperty.call(body, "promptpay_name") ||
        Object.prototype.hasOwnProperty.call(body, "bank_name") ||
        Object.prototype.hasOwnProperty.call(body, "account_type");

    if (hasIdentityUpdate) {
        requirements.push({ resourceKey: "shop_profile.identity.feature", actionKey: "update" });
    }

    if (hasContactUpdate) {
        requirements.push({ resourceKey: "shop_profile.contact.feature", actionKey: "update" });
    }

    if (hasPaymentProfileUpdate) {
        requirements.push({ resourceKey: "payment_accounts.edit.feature", actionKey: "update" });
    }

    if (requirements.length === 0) {
        requirements.push({ resourceKey: "shop_profile.identity.feature", actionKey: "update" });
    }

    return requirements;
};

router.get("/", authorizePermission("shop_profile.page", "view"), getShopProfile);
router.put("/", authorizeResolvedPermissions((req) => resolveProfileUpdatePermissions((req.body ?? {}) as Record<string, unknown>)), validate(updateShopProfileSchema), updateShopProfile);
router.post("/", authorizeResolvedPermissions((req) => resolveProfileUpdatePermissions((req.body ?? {}) as Record<string, unknown>)), validate(updateShopProfileSchema), updateShopProfile); // Allow POST as update too

export default router;
