import { Router } from "express";
import { OrderQueueController } from "../../controllers/pos/orderQueue.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";

const router = Router();
const orderQueueController = new OrderQueueController();

// Protect all routes
router.use(authenticateToken);
router.use(requireBranch);

// Routes
router.post("/", authorizePermission("queue.page", "create"), orderQueueController.addToQueue);
router.get("/", authorizePermission("queue.page", "view"), orderQueueController.getQueue);
router.patch("/:id/status", authorizePermission("queue.page", "update"), orderQueueController.updateStatus);
router.delete("/:id", authorizePermission("queue.page", "delete"), orderQueueController.removeFromQueue);
router.post("/reorder", authorizePermission("queue.page", "update"), orderQueueController.reorderQueue);

export default router;
