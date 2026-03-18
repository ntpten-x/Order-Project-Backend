import { Router } from "express";
import { ToppingGroupController } from "../../controllers/pos/toppingGroup.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission, authorizeResolvedPermissions } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validate.middleware";
import { ToppingGroupModels } from "../../models/pos/toppingGroup.model";
import { ToppingGroupService } from "../../services/pos/toppingGroup.service";
import { paginationQuerySchema } from "../../utils/schemas/common.schema";
import {
    createToppingGroupSchema,
    toppingGroupIdParamSchema,
    toppingGroupNameParamSchema,
    updateToppingGroupSchema,
} from "../../utils/schemas/posMaster.schema";

const router = Router();

const toppingGroupModel = new ToppingGroupModels();
const toppingGroupService = new ToppingGroupService(toppingGroupModel);
const toppingGroupController = new ToppingGroupController(toppingGroupService);

router.use(authenticateToken);
router.use(requireBranch);

router.get(
    "/",
    authorizeResolvedPermissions((req) => {
        const requirements = [{ resourceKey: "topping_group.page", actionKey: "view" }];
        const searchText = String(req.query?.q ?? "").trim();
        const status = String(req.query?.status ?? "").trim().toLowerCase();
        const sortCreated = String(req.query?.sort_created ?? "").trim().toLowerCase();

        if (searchText) {
            requirements.push({ resourceKey: "topping_group.search.feature", actionKey: "view" });
        }

        if (status && status !== "all") {
            requirements.push({ resourceKey: "topping_group.filter.feature", actionKey: "view" });
        }

        if (sortCreated === "old" || sortCreated === "new") {
            requirements.push({ resourceKey: "topping_group.filter.feature", actionKey: "view" });
        }

        return requirements;
    }),
    validate(paginationQuerySchema),
    toppingGroupController.findAll
);
router.get(
    "/name/:name",
    authorizePermission("topping_group.manager.feature", "access"),
    validate(toppingGroupNameParamSchema),
    toppingGroupController.findOneByName
);
router.get(
    "/:id",
    authorizePermission("topping_group.manager.feature", "access"),
    validate(toppingGroupIdParamSchema),
    toppingGroupController.findOne
);

router.post(
    "/",
    authorizePermission("topping_group.page", "create"),
    authorizePermission("topping_group.manager.feature", "access"),
    authorizePermission("topping_group.create.feature", "create"),
    validate(createToppingGroupSchema),
    toppingGroupController.create
);
router.put(
    "/:id",
    authorizeResolvedPermissions((req) => {
        const requirements = [
            { resourceKey: "topping_group.page", actionKey: "update" },
            { resourceKey: "topping_group.manager.feature", actionKey: "access" },
        ];

        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "display_name")) {
            requirements.push({ resourceKey: "topping_group.edit.feature", actionKey: "update" });
        }

        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "is_active")) {
            requirements.push({ resourceKey: "topping_group.status.feature", actionKey: "update" });
        }

        if (requirements.length === 2) {
            requirements.push({ resourceKey: "topping_group.edit.feature", actionKey: "update" });
        }

        return requirements;
    }),
    validate(updateToppingGroupSchema),
    toppingGroupController.update
);
router.delete(
    "/:id",
    authorizePermission("topping_group.page", "delete"),
    authorizePermission("topping_group.manager.feature", "access"),
    authorizePermission("topping_group.delete.feature", "delete"),
    validate(toppingGroupIdParamSchema),
    toppingGroupController.delete
);

export default router;
