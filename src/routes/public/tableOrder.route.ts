import { Router } from "express";
import { PublicTableOrderService } from "../../services/public/tableOrderPublic.service";
import { PublicTableOrderController } from "../../controllers/public/tableOrderPublic.controller";
import { validate } from "../../middleware/validate.middleware";
import {
    publicOrderByIdParamSchema,
    publicSubmitOrderSchema,
    publicTableTokenParamSchema,
} from "../../utils/schemas/publicTableOrder.schema";

const router = Router();

const service = new PublicTableOrderService();
const controller = new PublicTableOrderController(service);

router.get("/:token", validate(publicTableTokenParamSchema), controller.bootstrap);
router.get("/:token/order", validate(publicTableTokenParamSchema), controller.getActiveOrder);
router.get("/:token/order/:orderId", validate(publicOrderByIdParamSchema), controller.getOrder);
router.post("/:token/order", validate(publicSubmitOrderSchema), controller.submit);

export default router;
