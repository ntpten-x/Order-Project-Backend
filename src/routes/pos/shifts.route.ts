
import { Router } from "express";
import { ShiftsController } from "../../controllers/pos/shifts.controller";
import { ShiftsService } from "../../services/pos/shifts.service";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { validate } from "../../middleware/validate.middleware";
import { closeShiftSchema, openShiftSchema, shiftSummaryIdParamSchema } from "../../utils/schemas/posMaster.schema";

const shiftsRouter = Router();
const shiftsService = new ShiftsService();
const shiftsController = new ShiftsController(shiftsService);

// All shift routes require authentication
shiftsRouter.post("/open", authenticateToken, requireBranch, validate(openShiftSchema), shiftsController.openShift);
shiftsRouter.post("/close", authenticateToken, requireBranch, validate(closeShiftSchema), shiftsController.closeShift);
shiftsRouter.get("/current", authenticateToken, requireBranch, shiftsController.getCurrentShift);
shiftsRouter.get("/current/summary", authenticateToken, requireBranch, shiftsController.getCurrentSummary);
shiftsRouter.get("/summary/:id", authenticateToken, requireBranch, validate(shiftSummaryIdParamSchema), shiftsController.getSummary);

export default shiftsRouter;
