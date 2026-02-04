import { Router } from "express";
import { DashboardController } from "../../controllers/pos/dashboard.controller";
import { DashboardService } from "../../services/pos/dashboard.service";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";

const dashboardRouter = Router();
const dashboardService = new DashboardService();
const dashboardController = new DashboardController(dashboardService);

dashboardRouter.get(
    "/sales",
    authenticateToken,
    requireBranch,
    dashboardController.getSalesSummary
);

dashboardRouter.get(
    "/top-items",
    authenticateToken,
    requireBranch,
    dashboardController.getTopSellingItems
);

export default dashboardRouter;
