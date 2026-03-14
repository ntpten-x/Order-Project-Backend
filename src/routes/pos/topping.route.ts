import { Router } from "express";
import { ToppingController } from "../../controllers/pos/topping.controller";
import { ToppingService } from "../../services/pos/topping.service";
import { ToppingModels } from "../../models/pos/topping.model";
import { authenticateToken } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
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

router.get("/", authorizePermission("topping.page", "view"), validate(paginationQuerySchema), toppingController.findAll);
router.get("/name/:name", authorizePermission("topping.page", "view"), validate(toppingNameParamSchema), toppingController.findOneByName);
router.get("/:id", authorizePermission("topping.page", "view"), validate(toppingIdParamSchema), toppingController.findOne);

router.post("/", authorizePermission("topping.page", "create"), validate(createToppingSchema), toppingController.create);
router.put("/:id", authorizePermission("topping.page", "update"), validate(updateToppingSchema), toppingController.update);
router.delete("/:id", authorizePermission("topping.page", "delete"), validate(toppingIdParamSchema), toppingController.delete);

export default router;
