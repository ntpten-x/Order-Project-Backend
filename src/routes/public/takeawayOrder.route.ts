import { Router } from "express";
import { PublicTakeawayOrderController } from "../../controllers/public/takeawayOrderPublic.controller";
import { validate } from "../../middleware/validate.middleware";
import { PublicTakeawayOrderService } from "../../services/public/takeawayOrderPublic.service";
import {
    publicTakeawayOrderByIdParamSchema,
    publicTakeawaySubmitOrderSchema,
    publicTakeawayTokenParamSchema,
} from "../../utils/schemas/publicTakeawayOrder.schema";

const router = Router();
const controller = new PublicTakeawayOrderController(new PublicTakeawayOrderService());

router.get("/:token", validate(publicTakeawayTokenParamSchema), controller.bootstrap);
router.get("/:token/order/:orderId", validate(publicTakeawayOrderByIdParamSchema), controller.getOrder);
router.post("/:token/order", validate(publicTakeawaySubmitOrderSchema), controller.submit);

export default router;
