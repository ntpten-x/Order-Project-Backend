import { Router } from "express";
import { BackgroundJobsController } from "../../controllers/pos/backgroundJobs.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validate.middleware";
import { backgroundJobsService } from "../../services/pos/backgroundJobs.service";
import {
    backgroundJobIdParamSchema,
    createGenerateReportJobSchema,
    createSyncStockJobSchema,
} from "../../utils/schemas/posBackgroundJobs.schema";

const backgroundJobsRouter = Router();
const backgroundJobsController = new BackgroundJobsController(backgroundJobsService);

backgroundJobsRouter.use(authenticateToken);
backgroundJobsRouter.use(requireBranch);

backgroundJobsRouter.post(
    "/reports",
    authorizePermission("reports.sales.page", "view"),
    validate(createGenerateReportJobSchema),
    backgroundJobsController.enqueueGenerateReport
);

backgroundJobsRouter.get(
    "/reports/:jobId",
    authorizePermission("reports.sales.page", "view"),
    validate(backgroundJobIdParamSchema),
    backgroundJobsController.getGenerateReportStatus
);

backgroundJobsRouter.post(
    "/stock-sync",
    authorizePermission("stock.orders.page", "update"),
    validate(createSyncStockJobSchema),
    backgroundJobsController.enqueueSyncStock
);

backgroundJobsRouter.get(
    "/stock-sync/:jobId",
    authorizePermission("stock.orders.page", "view"),
    validate(backgroundJobIdParamSchema),
    backgroundJobsController.getSyncStockStatus
);

export default backgroundJobsRouter;
