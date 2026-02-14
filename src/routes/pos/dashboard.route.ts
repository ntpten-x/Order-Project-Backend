import { Router } from "express";
import { DashboardController } from "../../controllers/pos/dashboard.controller";
import { DashboardService } from "../../services/pos/dashboard.service";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission } from "../../middleware/permission.middleware";

const dashboardRouter = Router();
const dashboardService = new DashboardService();
const dashboardController = new DashboardController(dashboardService);

dashboardRouter.get(
    "/overview",
    authenticateToken,
    authorizePermission("reports.sales.page", "view"),
    requireBranch,
    dashboardController.getOverview
);

dashboardRouter.get(
    "/sales",
    authenticateToken,
    authorizePermission("reports.sales.page", "view"),
    requireBranch,
    dashboardController.getSalesSummary
);

dashboardRouter.get(
    "/top-items",
    authenticateToken,
    authorizePermission("reports.sales.page", "view"),
    requireBranch,
    dashboardController.getTopSellingItems
);

export default dashboardRouter;
