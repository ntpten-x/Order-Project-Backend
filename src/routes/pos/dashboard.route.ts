import { Router } from "express";
import { DashboardController } from "../../controllers/pos/dashboard.controller";
import { DashboardService } from "../../services/pos/dashboard.service";
import { authenticateToken } from "../../middleware/auth.middleware";

const dashboardRouter = Router();
const dashboardService = new DashboardService();
const dashboardController = new DashboardController(dashboardService);

dashboardRouter.get(
    "/sales",
    authenticateToken,
    dashboardController.getSalesSummary
);

dashboardRouter.get(
    "/top-items",
    authenticateToken,
    dashboardController.getTopSellingItems
);

export default dashboardRouter;
