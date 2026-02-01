import { Router } from "express";
import { OrderQueueController } from "../../controllers/pos/orderQueue.controller";
import { authenticateToken, authorizeRole } from "../../middleware/auth.middleware";

const router = Router();
const orderQueueController = new OrderQueueController();

// Protect all routes
router.use(authenticateToken);
router.use(authorizeRole(["Admin", "Manager", "Employee"]));

// Routes
router.post("/", orderQueueController.addToQueue);
router.get("/", orderQueueController.getQueue);
router.patch("/:id/status", orderQueueController.updateStatus);
router.delete("/:id", orderQueueController.removeFromQueue);
router.post("/reorder", orderQueueController.reorderQueue);

export default router;
