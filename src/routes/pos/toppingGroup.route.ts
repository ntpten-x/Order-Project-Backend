import { Router } from "express";
import { ToppingGroupController } from "../../controllers/pos/toppingGroup.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
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

router.get("/", authorizePermission("topping.page", "view"), validate(paginationQuerySchema), toppingGroupController.findAll);
router.get("/name/:name", authorizePermission("topping.page", "view"), validate(toppingGroupNameParamSchema), toppingGroupController.findOneByName);
router.get("/:id", authorizePermission("topping.page", "view"), validate(toppingGroupIdParamSchema), toppingGroupController.findOne);

router.post("/", authorizePermission("topping.page", "create"), validate(createToppingGroupSchema), toppingGroupController.create);
router.put("/:id", authorizePermission("topping.page", "update"), validate(updateToppingGroupSchema), toppingGroupController.update);
router.delete("/:id", authorizePermission("topping.page", "delete"), validate(toppingGroupIdParamSchema), toppingGroupController.delete);

export default router;
