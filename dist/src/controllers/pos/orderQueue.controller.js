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
exports.OrderQueueController = void 0;
const orderQueue_service_1 = require("../../services/pos/orderQueue.service");
const OrderQueue_1 = require("../../entity/pos/OrderQueue");
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const auditLogger_1 = require("../../utils/auditLogger");
const securityLogger_1 = require("../../utils/securityLogger");
class OrderQueueController {
    constructor() {
        this.queueService = new orderQueue_service_1.OrderQueueService();
        /**
         * Add order to queue
         */
        this.addToQueue = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const { orderId, priority } = req.body;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            if (!orderId) {
                throw AppError_1.AppError.badRequest("Order ID is required");
            }
            const queuePriority = priority || OrderQueue_1.QueuePriority.Normal;
            const queueItem = yield this.queueService.addToQueue(orderId, queuePriority, branchId);
            // Audit log
            yield auditLogger_1.auditLogger.log({
                action_type: auditLogger_1.AuditActionType.QUEUE_ADD,
                user_id: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                username: (_c = req.user) === null || _c === void 0 ? void 0 : _c.username,
                ip_address: (0, securityLogger_1.getClientIp)(req),
                user_agent: req.headers['user-agent'],
                entity_type: 'OrderQueue',
                entity_id: queueItem.id,
                branch_id: branchId,
                new_values: { order_id: orderId, priority: queuePriority, status: queueItem.status },
                description: `Added order ${orderId} to queue`,
                path: req.path,
                method: req.method,
            });
            return ApiResponse_1.ApiResponses.created(res, queueItem);
        }));
        /**
         * Get queue list
         */
        this.getQueue = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            const status = req.query.status;
            const queue = yield this.queueService.getQueue(branchId, status);
            return ApiResponse_1.ApiResponses.ok(res, queue);
        }));
        /**
         * Update queue status
         */
        this.updateStatus = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const { id } = req.params;
            const { status } = req.body;
            if (!status || !Object.values(OrderQueue_1.QueueStatus).includes(status)) {
                throw AppError_1.AppError.badRequest("Invalid status");
            }
            const oldQueueItem = yield this.queueService.getQueue((_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id).then(q => q.find(item => item.id === id));
            const updated = yield this.queueService.updateStatus(id, status);
            // Audit log
            yield auditLogger_1.auditLogger.log({
                action_type: auditLogger_1.AuditActionType.QUEUE_UPDATE,
                user_id: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                username: (_c = req.user) === null || _c === void 0 ? void 0 : _c.username,
                ip_address: (0, securityLogger_1.getClientIp)(req),
                user_agent: req.headers['user-agent'],
                entity_type: 'OrderQueue',
                entity_id: id,
                branch_id: (_d = req.user) === null || _d === void 0 ? void 0 : _d.branch_id,
                old_values: oldQueueItem ? { status: oldQueueItem.status } : undefined,
                new_values: { status },
                description: `Updated queue status to ${status}`,
                path: req.path,
                method: req.method,
            });
            return ApiResponse_1.ApiResponses.ok(res, updated);
        }));
        /**
         * Remove from queue
         */
        this.removeFromQueue = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            yield this.queueService.removeFromQueue(id);
            return ApiResponse_1.ApiResponses.noContent(res);
        }));
        /**
         * Reorder queue
         */
        this.reorderQueue = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            yield this.queueService.reorderQueue(branchId);
            return ApiResponse_1.ApiResponses.ok(res, { message: "Queue reordered successfully" });
        }));
    }
}
exports.OrderQueueController = OrderQueueController;
