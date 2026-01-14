import { Router } from "express";
import { PosHistoryModel } from "../../models/pos/posHistory.model";
import { PosHistoryService } from "../../services/pos/posHistory.service";
import { PosHistoryController } from "../../controllers/pos/posHistory.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router();

const posHistoryModel = new PosHistoryModel();
const posHistoryService = new PosHistoryService(posHistoryModel);
const posHistoryController = new PosHistoryController(posHistoryService);

router.use(authenticateToken);
// Generally history is restricted effectively
router.use(authorizeRole(["Admin", "Manager"]));

router.get("/", posHistoryController.findAll);
router.get("/:id", posHistoryController.findOne);
router.post("/", posHistoryController.create);
router.put("/:id", posHistoryController.update);
router.delete("/:id", posHistoryController.delete);

export default router;
