
import { Router } from "express";
import { ShiftsController } from "../../controllers/pos/shifts.controller";
import { ShiftsService } from "../../services/pos/shifts.service";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission, authorizeResolvedPermissions } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validate.middleware";
import { closeShiftSchema, openShiftSchema, shiftSummaryIdParamSchema } from "../../utils/schemas/posMaster.schema";
import { paginationQuerySchema } from "../../utils/schemas/common.schema";

const shiftsRouter = Router();
const shiftsService = new ShiftsService();
const shiftsController = new ShiftsController(shiftsService);

shiftsRouter.use(authenticateToken);
shiftsRouter.use(requireBranch);

shiftsRouter.post("/open", authorizePermission("shifts.open.feature", "create"), validate(openShiftSchema), shiftsController.openShift);
shiftsRouter.post(
    "/close/preview",
    authorizePermission("shifts.close_preview.feature", "access"),
    validate(closeShiftSchema),
    shiftsController.previewCloseShift
);
shiftsRouter.post("/close", authorizePermission("shifts.close.feature", "update"), validate(closeShiftSchema), shiftsController.closeShift);
shiftsRouter.get("/current", authorizePermission("shifts.page", "view"), shiftsController.getCurrentShift);
shiftsRouter.get("/current/summary", authorizePermission("shifts.summary.feature", "view"), shiftsController.getCurrentSummary);
shiftsRouter.get(
    "/history",
    authorizeResolvedPermissions((req) => {
        const requirements: Array<{ resourceKey: string; actionKey: "view" }> = [
            { resourceKey: "shift_history.page", actionKey: "view" },
        ];

        if (typeof req.query.q === "string" && req.query.q.trim()) {
            requirements.push({ resourceKey: "shift_history.search.feature", actionKey: "view" });
        }

        if (
            req.query.status !== undefined ||
            req.query.date_from !== undefined ||
            req.query.date_to !== undefined ||
            req.query.sort_created !== undefined
        ) {
            requirements.push({ resourceKey: "shift_history.filter.feature", actionKey: "view" });
        }

        return requirements;
    }),
    validate(paginationQuerySchema),
    shiftsController.getHistory
);
shiftsRouter.get(
    "/summary/:id",
    authorizePermission("shift_history.summary.feature", "access"),
    validate(shiftSummaryIdParamSchema),
    shiftsController.getSummary
);

export default shiftsRouter;
