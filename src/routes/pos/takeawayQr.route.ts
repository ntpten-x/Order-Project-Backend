import { Router } from "express";
import { TakeawayQrController } from "../../controllers/pos/takeawayQr.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
import { TakeawayQrService } from "../../services/pos/takeawayQr.service";

const router = Router();
const controller = new TakeawayQrController(new TakeawayQrService());

router.use(authenticateToken);
router.use(requireBranch);

router.get("/", authorizePermission("orders.page", "view"), controller.getInfo);

export default router;
