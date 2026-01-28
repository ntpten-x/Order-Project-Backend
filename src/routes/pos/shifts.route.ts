
import { Router } from "express";
import { ShiftsController } from "../../controllers/pos/shifts.controller";
import { ShiftsService } from "../../services/pos/shifts.service";
import { authenticateToken } from "../../middleware/auth.middleware";

const shiftsRouter = Router();
const shiftsService = new ShiftsService();
const shiftsController = new ShiftsController(shiftsService);

// All shift routes require authentication
shiftsRouter.post("/open", authenticateToken, shiftsController.openShift);
shiftsRouter.post("/close", authenticateToken, shiftsController.closeShift);
shiftsRouter.get("/current", authenticateToken, shiftsController.getCurrentShift);
shiftsRouter.get("/current/summary", authenticateToken, shiftsController.getCurrentSummary);
shiftsRouter.get("/summary/:id", authenticateToken, shiftsController.getSummary);

export default shiftsRouter;
