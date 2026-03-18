import { Router } from "express";
import { ToppingController } from "../../controllers/pos/topping.controller";
import { ToppingService } from "../../services/pos/topping.service";
import { ToppingModels } from "../../models/pos/topping.model";
import { authenticateToken } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission, authorizeResolvedPermissions } from "../../middleware/permission.middleware";
import { paginationQuerySchema } from "../../utils/schemas/common.schema";
import {
    createToppingSchema,
    toppingIdParamSchema,
    toppingNameParamSchema,
    updateToppingSchema,
} from "../../utils/schemas/posMaster.schema";

const router = Router();

const toppingModel = new ToppingModels();
const toppingService = new ToppingService(toppingModel);
const toppingController = new ToppingController(toppingService);

router.use(authenticateToken);
router.use(requireBranch);

router.get(
    "/",
    authorizeResolvedPermissions((req) => {
        const requirements = [{ resourceKey: "topping.page", actionKey: "view" }];
        const hasSearch = typeof req.query.q === "string" && req.query.q.trim().length > 0;
        const hasFilter =
            (typeof req.query.status === "string" && req.query.status.trim().length > 0 && req.query.status !== "all") ||
            (typeof req.query.category_id === "string" && req.query.category_id.trim().length > 0 && req.query.category_id !== "all") ||
            (typeof req.query.sort_created === "string" && req.query.sort_created.trim().length > 0);

        if (hasSearch) {
            requirements.push({ resourceKey: "topping.search.feature", actionKey: "view" });
        }
        if (hasFilter) {
            requirements.push({ resourceKey: "topping.filter.feature", actionKey: "view" });
        }

        return requirements;
    }),
    validate(paginationQuerySchema),
    toppingController.findAll
);
router.get(
    "/name/:name",
    authorizePermission("topping.manager.feature", "access"),
    validate(toppingNameParamSchema),
    toppingController.findOneByName
);
router.get(
    "/:id",
    authorizePermission("topping.manager.feature", "access"),
    validate(toppingIdParamSchema),
    toppingController.findOne
);

router.post(
    "/",
    authorizePermission("topping.page", "create"),
    authorizePermission("topping.manager.feature", "access"),
    authorizePermission("topping.create.feature", "create"),
    validate(createToppingSchema),
    toppingController.create
);
router.put(
    "/:id",
    authorizeResolvedPermissions((req) => {
        const requirements = [
            { resourceKey: "topping.page", actionKey: "update" },
            { resourceKey: "topping.manager.feature", actionKey: "access" },
        ];
        const hasCatalogUpdate =
            Object.prototype.hasOwnProperty.call(req.body ?? {}, "display_name") ||
            Object.prototype.hasOwnProperty.call(req.body ?? {}, "img") ||
            Object.prototype.hasOwnProperty.call(req.body ?? {}, "category_ids") ||
            Object.prototype.hasOwnProperty.call(req.body ?? {}, "topping_group_ids");
        const hasPricingUpdate =
            Object.prototype.hasOwnProperty.call(req.body ?? {}, "price") ||
            Object.prototype.hasOwnProperty.call(req.body ?? {}, "price_delivery");
        const hasStatusUpdate = Object.prototype.hasOwnProperty.call(req.body ?? {}, "is_active");

        if (hasCatalogUpdate) {
            requirements.push({ resourceKey: "topping.catalog.feature", actionKey: "update" });
        }
        if (hasPricingUpdate) {
            requirements.push({ resourceKey: "topping.pricing.feature", actionKey: "update" });
        }
        if (hasStatusUpdate) {
            requirements.push({ resourceKey: "topping.status.feature", actionKey: "update" });
        }
        if (!hasCatalogUpdate && !hasPricingUpdate && !hasStatusUpdate) {
            requirements.push({ resourceKey: "topping.catalog.feature", actionKey: "update" });
        }

        return requirements;
    }),
    validate(updateToppingSchema),
    toppingController.update
);
router.delete(
    "/:id",
    authorizePermission("topping.page", "delete"),
    authorizePermission("topping.manager.feature", "access"),
    authorizePermission("topping.delete.feature", "delete"),
    validate(toppingIdParamSchema),
    toppingController.delete
);

export default router;
