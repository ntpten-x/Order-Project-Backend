
import { Router } from "express";
import { ShiftsController } from "../../controllers/pos/shifts.controller";
import { ShiftsService } from "../../services/pos/shifts.service";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validate.middleware";
import { closeShiftSchema, openShiftSchema, shiftSummaryIdParamSchema } from "../../utils/schemas/posMaster.schema";
import { paginationQuerySchema } from "../../utils/schemas/common.schema";

const shiftsRouter = Router();
const shiftsService = new ShiftsService();
const shiftsController = new ShiftsController(shiftsService);

shiftsRouter.use(authenticateToken);
shiftsRouter.use(requireBranch);

shiftsRouter.post("/open", authorizePermission("shifts.page", "create"), validate(openShiftSchema), shiftsController.openShift);
shiftsRouter.post("/close/preview", authorizePermission("shifts.page", "update"), validate(closeShiftSchema), shiftsController.previewCloseShift);
shiftsRouter.post("/close", authorizePermission("shifts.page", "update"), validate(closeShiftSchema), shiftsController.closeShift);
shiftsRouter.get("/current", authorizePermission("shifts.page", "view"), shiftsController.getCurrentShift);
shiftsRouter.get("/current/summary", authorizePermission("shifts.page", "view"), shiftsController.getCurrentSummary);
shiftsRouter.get("/history", authorizePermission("shifts.page", "view"), validate(paginationQuerySchema), shiftsController.getHistory);
shiftsRouter.get("/summary/:id", authorizePermission("shifts.page", "view"), validate(shiftSummaryIdParamSchema), shiftsController.getSummary);

export default shiftsRouter;
