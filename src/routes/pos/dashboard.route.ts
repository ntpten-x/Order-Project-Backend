import { Router } from "express";
import { DashboardController } from "../../controllers/pos/dashboard.controller";
import { DashboardService } from "../../services/pos/dashboard.service";
import { OrdersModels } from "../../models/pos/orders.model";
import { OrdersService } from "../../services/pos/orders.service";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import { authorizePermission, enforceOrderTargetScope } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validate.middleware";
import { orderIdParamSchema } from "../../utils/schemas/posOrders.schema";

const dashboardRouter = Router();
const dashboardService = new DashboardService();
const ordersModel = new OrdersModels();
const ordersService = new OrdersService(ordersModel);
const dashboardController = new DashboardController(dashboardService, ordersService);

dashboardRouter.get(
    "/overview",
    authenticateToken,
    authorizePermission("reports.sales.page", "view"),
    requireBranch,
    dashboardController.getOverview
);

dashboardRouter.get(
    "/orders/:id",
    authenticateToken,
    authorizePermission("reports.sales.page", "view"),
    requireBranch,
    enforceOrderTargetScope("id"),
    validate(orderIdParamSchema),
    dashboardController.getOrderDetail
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
