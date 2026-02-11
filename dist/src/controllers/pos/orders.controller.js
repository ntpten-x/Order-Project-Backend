"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const auditLogger_1 = require("../../utils/auditLogger");
const securityLogger_1 = require("../../utils/securityLogger");
const ApiResponse_1 = require("../../utils/ApiResponse");
const branch_middleware_1 = require("../../middleware/branch.middleware");
const statusQuery_1 = require("../../utils/statusQuery");
class OrdersController {
    constructor(ordersService) {
        this.ordersService = ordersService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const limitRaw = parseInt(req.query.limit) || 50;
            const limit = Math.min(Math.max(limitRaw, 1), 200); // cap to prevent huge payloads
            const statuses = (0, statusQuery_1.parseStatusQuery)(req.query.status);
            const type = req.query.type;
            const query = req.query.q;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const result = yield this.ordersService.findAll(page, limit, statuses, type, query, branchId);
            return ApiResponse_1.ApiResponses.paginated(res, result.data, {
                page: result.page,
                limit: result.limit,
                total: result.total,
            });
        }));
        this.findSummary = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const limitRaw = parseInt(req.query.limit) || 50;
            const limit = Math.min(Math.max(limitRaw, 1), 200);
            const statuses = (0, statusQuery_1.parseStatusQuery)(req.query.status);
            const type = req.query.type;
            const query = req.query.q;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const result = yield this.ordersService.findAllSummary(page, limit, statuses, type, query, branchId);
            return ApiResponse_1.ApiResponses.paginated(res, result.data, {
                page: result.page,
                limit: result.limit,
                total: result.total,
            });
        }));
        this.getStats = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const stats = yield this.ordersService.getStats(branchId);
            return ApiResponse_1.ApiResponses.ok(res, stats);
        }));
        this.findAllItems = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const status = req.query.status;
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const limitRaw = parseInt(req.query.limit) || 100;
            const limit = Math.min(Math.max(limitRaw, 1), 200); // cap to prevent huge payloads
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const result = yield this.ordersService.findAllItems(status, page, limit, branchId);
            return ApiResponse_1.ApiResponses.paginated(res, result.data, {
                page: result.page,
                limit: result.limit,
                total: result.total,
            });
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const order = yield this.ordersService.findOne(req.params.id, branchId);
            if (!order) {
                throw new AppError_1.AppError("ไม่พบข้อมูลออเดอร์", 404);
            }
            return ApiResponse_1.ApiResponses.ok(res, order);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const user = req.user;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (user === null || user === void 0 ? void 0 : user.id) {
                req.body.created_by_id = user.id;
            }
            if (branchId) {
                // Always enforce branch isolation server-side (ignore client-provided branch_id)
                req.body.branch_id = branchId;
            }
            // Check if input has items, if so use createFullOrder
            let order;
            if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
                order = yield this.ordersService.createFullOrder(req.body, branchId);
            }
            else {
                order = yield this.ordersService.create(req.body, branchId);
            }
            // Audit log
            yield auditLogger_1.auditLogger.log({
                action_type: auditLogger_1.AuditActionType.ORDER_CREATE,
                user_id: user === null || user === void 0 ? void 0 : user.id,
                username: user === null || user === void 0 ? void 0 : user.username,
                ip_address: (0, securityLogger_1.getClientIp)(req),
                user_agent: req.headers['user-agent'],
                entity_type: 'SalesOrder',
                entity_id: order.id,
                branch_id: branchId,
                new_values: { order_no: order.order_no, status: order.status, order_type: order.order_type },
                description: `Created order ${order.order_no}`,
                path: req.path,
                method: req.method,
            });
            return ApiResponse_1.ApiResponses.created(res, order);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const user = req.user;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                // Prevent branch_id tampering
                req.body.branch_id = branchId;
            }
            const oldOrder = yield this.ordersService.findOne(req.params.id, branchId);
            const order = yield this.ordersService.update(req.params.id, req.body, branchId);
            // Audit log
            yield auditLogger_1.auditLogger.log({
                action_type: auditLogger_1.AuditActionType.ORDER_UPDATE,
                user_id: user === null || user === void 0 ? void 0 : user.id,
                username: user === null || user === void 0 ? void 0 : user.username,
                ip_address: (0, securityLogger_1.getClientIp)(req),
                user_agent: req.headers['user-agent'],
                entity_type: 'SalesOrder',
                entity_id: order.id,
                branch_id: branchId,
                old_values: oldOrder ? { status: oldOrder.status, order_no: oldOrder.order_no } : undefined,
                new_values: { status: order.status, order_no: order.order_no },
                description: `Updated order ${order.order_no}`,
                path: req.path,
                method: req.method,
            });
            // Extra audit for status changes (important operational event)
            if ((oldOrder === null || oldOrder === void 0 ? void 0 : oldOrder.status) && ((_a = req.body) === null || _a === void 0 ? void 0 : _a.status) && String(oldOrder.status) !== String(req.body.status)) {
                yield auditLogger_1.auditLogger.log({
                    action_type: auditLogger_1.AuditActionType.ORDER_STATUS_CHANGE,
                    user_id: user === null || user === void 0 ? void 0 : user.id,
                    username: user === null || user === void 0 ? void 0 : user.username,
                    ip_address: (0, securityLogger_1.getClientIp)(req),
                    user_agent: req.headers['user-agent'],
                    entity_type: 'SalesOrder',
                    entity_id: order.id,
                    branch_id: branchId,
                    old_values: { status: oldOrder.status },
                    new_values: { status: req.body.status },
                    description: `Changed order status ${order.order_no}: ${oldOrder.status} -> ${req.body.status}`,
                    path: req.path,
                    method: req.method,
                });
            }
            return ApiResponse_1.ApiResponses.ok(res, order);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const user = req.user;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const oldOrder = yield this.ordersService.findOne(req.params.id, branchId);
            yield this.ordersService.delete(req.params.id, branchId);
            // Audit log - important destructive action
            yield auditLogger_1.auditLogger.log({
                action_type: auditLogger_1.AuditActionType.ORDER_DELETE,
                user_id: user === null || user === void 0 ? void 0 : user.id,
                username: user === null || user === void 0 ? void 0 : user.username,
                ip_address: (0, securityLogger_1.getClientIp)(req),
                user_agent: req.headers['user-agent'],
                entity_type: 'SalesOrder',
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldOrder ? { order_no: oldOrder.order_no, status: oldOrder.status } : undefined,
                description: oldOrder ? `Deleted order ${oldOrder.order_no}` : `Deleted order ${req.params.id}`,
                path: req.path,
                method: req.method,
            });
            return ApiResponse_1.ApiResponses.ok(res, { message: "ลบข้อมูลออเดอร์สำเร็จ" });
        }));
        this.updateItemStatus = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const { status } = req.body;
            if (!status) {
                throw new AppError_1.AppError("กรุณาระบุสถานะ", 400);
            }
            yield this.ordersService.updateItemStatus(req.params.id, status, branchId);
            return ApiResponse_1.ApiResponses.ok(res, { message: "อัปเดตสถานะสำเร็จ" });
        }));
        this.addItem = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const user = req.user;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const order = yield this.ordersService.addItem(req.params.id, req.body, branchId);
            // Audit log
            yield auditLogger_1.auditLogger.log({
                action_type: auditLogger_1.AuditActionType.ITEM_ADD,
                user_id: user === null || user === void 0 ? void 0 : user.id,
                username: user === null || user === void 0 ? void 0 : user.username,
                ip_address: (0, securityLogger_1.getClientIp)(req),
                user_agent: req.headers['user-agent'],
                entity_type: 'SalesOrder',
                entity_id: order.id,
                branch_id: branchId,
                new_values: { product_id: req.body.product_id, quantity: req.body.quantity },
                description: `Added item to order ${order.order_no}`,
                path: req.path,
                method: req.method,
            });
            return ApiResponse_1.ApiResponses.created(res, order);
        }));
        this.updateItem = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const user = req.user;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const order = yield this.ordersService.updateItemDetails(req.params.itemId, req.body, branchId);
            // Audit log - item modifications affect bill/operations
            yield auditLogger_1.auditLogger.log({
                action_type: auditLogger_1.AuditActionType.ITEM_UPDATE,
                user_id: user === null || user === void 0 ? void 0 : user.id,
                username: user === null || user === void 0 ? void 0 : user.username,
                ip_address: (0, securityLogger_1.getClientIp)(req),
                user_agent: req.headers['user-agent'],
                entity_type: 'SalesOrderItem',
                entity_id: req.params.itemId,
                branch_id: branchId,
                new_values: req.body,
                description: (order === null || order === void 0 ? void 0 : order.order_no) ? `Updated item in order ${order.order_no}` : `Updated order item ${req.params.itemId}`,
                path: req.path,
                method: req.method,
            });
            return ApiResponse_1.ApiResponses.ok(res, order);
        }));
        this.deleteItem = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const user = req.user;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const order = yield this.ordersService.deleteItem(req.params.itemId, branchId);
            // Audit log - important destructive action
            yield auditLogger_1.auditLogger.log({
                action_type: auditLogger_1.AuditActionType.ITEM_DELETE,
                user_id: user === null || user === void 0 ? void 0 : user.id,
                username: user === null || user === void 0 ? void 0 : user.username,
                ip_address: (0, securityLogger_1.getClientIp)(req),
                user_agent: req.headers['user-agent'],
                entity_type: 'SalesOrderItem',
                entity_id: req.params.itemId,
                branch_id: branchId,
                description: (order === null || order === void 0 ? void 0 : order.order_no) ? `Deleted item from order ${order.order_no}` : `Deleted order item ${req.params.itemId}`,
                path: req.path,
                method: req.method,
            });
            return ApiResponse_1.ApiResponses.ok(res, order);
        }));
    }
}
exports.OrdersController = OrdersController;
