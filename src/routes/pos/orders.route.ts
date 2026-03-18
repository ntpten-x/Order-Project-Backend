import { Router } from "express";
import { OrdersModels } from "../../models/pos/orders.model";
import { OrdersService } from "../../services/pos/orders.service";
import { OrdersController } from "../../controllers/pos/orders.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireBranch } from "../../middleware/branch.middleware";
import {
    authorizeOrderCancellation,
    authorizePermission,
    authorizeResolvedPermissions,
    enforceOrderItemTargetScope,
    enforceOrderTargetScope,
    enforceServingGroupTargetScope,
} from "../../middleware/permission.middleware";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { paginationQuerySchema } from "../../utils/schemas/common.schema";
import {
    addOrderItemSchema,
    createOrderSchema,
    orderIdParamSchema,
    orderItemIdParamSchema,
    updateOrderItemSchema,
    updateOrderItemStatusSchema,
    updateOrderSchema,
    updateServingGroupStatusSchema,
    updateServingItemStatusSchema,
} from "../../utils/schemas/posOrders.schema";

const router = Router()

const ordersModel = new OrdersModels()
const ordersService = new OrdersService(ordersModel)
const ordersController = new OrdersController(ordersService)

const resolveOrderSearchAndFilterPermissions = (req: AuthRequest) => {
    const requirements: Array<{ resourceKey: string; actionKey: "view" | "access" | "create" | "update" | "delete" }> = [];

    if (typeof req.query.q === "string" && req.query.q.trim()) {
        requirements.push({ resourceKey: "orders.search.feature", actionKey: "view" });
    }

    if (
        typeof req.query.status === "string" ||
        typeof req.query.type === "string" ||
        typeof req.query.sort_created === "string"
    ) {
        requirements.push({ resourceKey: "orders.filter.feature", actionKey: "view" });
    }

    return requirements;
};

const resolveSummaryPermissions = (req: AuthRequest) => {
    const requirements: Array<{ resourceKey: string; actionKey: "view" | "access" | "create" | "update" | "delete" }> = [
        { resourceKey: "orders.summary.feature", actionKey: "view" },
    ];

    if (typeof req.query.type === "string" && req.query.type.trim()) {
        requirements.push({ resourceKey: "orders.channels.feature", actionKey: "view" });
    }

    return requirements.concat(resolveOrderSearchAndFilterPermissions(req));
};

const resolveOrderListPermissions = (req: AuthRequest) => {
    return [{ resourceKey: "orders.page", actionKey: "view" }].concat(resolveOrderSearchAndFilterPermissions(req));
};

router.use(authenticateToken)
router.use(requireBranch)

// Specific routes must come before dynamic routes like /:id
router.get("/stats", authorizePermission("orders.summary.feature", "view"), ordersController.getStats)
router.get("/summary", authorizeResolvedPermissions(resolveSummaryPermissions), validate(paginationQuerySchema), ordersController.findSummary)
router.get("/serve-board", authorizePermission("orders.serving_board.feature", "view"), ordersController.getServingBoard)
router.patch("/serve-board/items/:id", authorizePermission("orders.serving_board_update.feature", "update"), enforceOrderItemTargetScope("id"), validate(updateServingItemStatusSchema), ordersController.updateServingItemStatus)
router.patch("/serve-board/groups/:id", authorizePermission("orders.serving_board_update.feature", "update"), enforceServingGroupTargetScope("id"), validate(updateServingGroupStatusSchema), ordersController.updateServingGroupStatus)

router.get("/", authorizeResolvedPermissions(resolveOrderListPermissions), validate(paginationQuerySchema), ordersController.findAll)
router.get("/items", authorizePermission("orders.page", "view"), ordersController.findAllItems)
router.get("/:id", authorizePermission("orders.detail.feature", "access"), enforceOrderTargetScope("id"), validate(orderIdParamSchema), ordersController.findOne)

router.post("/", authorizePermission("orders.channel_create.feature", "create"), validate(createOrderSchema), ordersController.create)
router.put(
    "/:id",
    authorizePermission("orders.edit.feature", "update"),
    validate(updateOrderSchema),
    authorizeOrderCancellation(),
    enforceOrderTargetScope("id"),
    ordersController.update
)
router.delete("/:id", authorizePermission("orders.page", "delete"), enforceOrderTargetScope("id"), validate(orderIdParamSchema), ordersController.delete)
router.patch(
    "/items/:id/status",
    authorizePermission("orders.item_status.feature", "update"),
    validate(updateOrderItemStatusSchema),
    enforceOrderItemTargetScope("id"),
    ordersController.updateItemStatus
)

// Item Management Routes
router.post("/:id/items", authorizePermission("orders.line_items.feature", "update"), enforceOrderTargetScope("id"), validate(addOrderItemSchema), ordersController.addItem)
router.put("/items/:itemId", authorizePermission("orders.line_items.feature", "update"), enforceOrderItemTargetScope("itemId"), validate(updateOrderItemSchema), ordersController.updateItem)
router.delete("/items/:itemId", authorizePermission("orders.line_items.feature", "update"), enforceOrderItemTargetScope("itemId"), validate(orderItemIdParamSchema), ordersController.deleteItem)

export default router
