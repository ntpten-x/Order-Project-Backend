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
const orders_service_1 = require("../../services/stock/orders.service");
const PurchaseOrder_1 = require("../../entity/stock/PurchaseOrder");
const orders_model_1 = require("../../models/stock/orders.model");
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const auditLogger_1 = require("../../utils/auditLogger");
const securityLogger_1 = require("../../utils/securityLogger");
const branch_middleware_1 = require("../../middleware/branch.middleware");
/**
 * Stock Orders Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 * - Input validation
 */
class OrdersController {
    constructor() {
        this.ordersModel = new orders_model_1.StockOrdersModel();
        this.ordersService = new orders_service_1.OrdersService(this.ordersModel);
        this.createOrder = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { ordered_by_id, items, remark } = req.body;
            const branch_id = (0, branch_middleware_1.getBranchId)(req);
            // Validate input
            if (!ordered_by_id || !items || !Array.isArray(items) || items.length === 0) {
                throw AppError_1.AppError.badRequest("ไม่พบข้อมูลการสั่งซื้อ");
            }
            const order = yield this.ordersService.createOrder(ordered_by_id, items, remark, branch_id);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.STOCK_ORDER_CREATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "PurchaseOrder", entity_id: order.id, branch_id: branch_id, new_values: { ordered_by_id, items, remark }, path: req.originalUrl, method: req.method, description: `Create stock order ${order.id}` }));
            return ApiResponse_1.ApiResponses.created(res, order);
        }));
        this.getAllOrders = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const statusParam = req.query.status;
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
            let statusFilter;
            if (statusParam) {
                const statuses = statusParam.split(',');
                // Validate statuses
                const validStatuses = statuses.filter(s => Object.values(PurchaseOrder_1.PurchaseOrderStatus).includes(s));
                if (validStatuses.length === 0) {
                    throw AppError_1.AppError.badRequest("สถานะไม่ถูกต้อง");
                }
                statusFilter = validStatuses.length > 1 ? validStatuses : validStatuses[0];
            }
            const branch_id = (0, branch_middleware_1.getBranchId)(req);
            const result = yield this.ordersService.getAllOrders(statusFilter ? { status: statusFilter } : undefined, page, limit, branch_id);
            return ApiResponse_1.ApiResponses.paginated(res, result.data, {
                page: result.page,
                limit: result.limit,
                total: result.total,
            });
        }));
        this.getOrderById = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const branch_id = (0, branch_middleware_1.getBranchId)(req);
            const order = yield this.ordersService.getOrderById(id, branch_id);
            if (!order) {
                throw AppError_1.AppError.notFound("การสั่งซื้อ");
            }
            return ApiResponse_1.ApiResponses.ok(res, order);
        }));
        this.updateOrder = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { items } = req.body;
            if (!items || !Array.isArray(items) || items.length === 0) {
                throw AppError_1.AppError.badRequest("ไม่พบข้อมูลสินค้า");
            }
            const branch_id = (0, branch_middleware_1.getBranchId)(req);
            const oldOrder = yield this.ordersService.getOrderById(id, branch_id);
            const updatedOrder = yield this.ordersService.updateOrder(id, items, branch_id);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.STOCK_ORDER_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "PurchaseOrder", entity_id: id, branch_id: branch_id, old_values: oldOrder, new_values: { items }, path: req.originalUrl, method: req.method, description: `Update stock order ${id}` }));
            return ApiResponse_1.ApiResponses.ok(res, updatedOrder);
        }));
        this.updateStatus = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { status } = req.body;
            if (!status || !Object.values(PurchaseOrder_1.PurchaseOrderStatus).includes(status)) {
                throw AppError_1.AppError.badRequest("สถานะไม่ถูกต้อง");
            }
            const branch_id = (0, branch_middleware_1.getBranchId)(req);
            const oldOrder = yield this.ordersService.getOrderById(id, branch_id);
            const updatedOrder = yield this.ordersService.updateStatus(id, status, branch_id);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.STOCK_ORDER_STATUS_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "PurchaseOrder", entity_id: id, branch_id: branch_id, old_values: oldOrder, new_values: { status }, path: req.originalUrl, method: req.method, description: `Update stock order status ${id} -> ${status}` }));
            return ApiResponse_1.ApiResponses.ok(res, updatedOrder);
        }));
        this.deleteOrder = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const branch_id = (0, branch_middleware_1.getBranchId)(req);
            const oldOrder = yield this.ordersService.getOrderById(id, branch_id);
            const result = yield this.ordersService.deleteOrder(id, branch_id);
            if (result === null || result === void 0 ? void 0 : result.affected) {
                const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
                yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.STOCK_ORDER_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "PurchaseOrder", entity_id: id, branch_id: branch_id, old_values: oldOrder, path: req.originalUrl, method: req.method, description: `Delete stock order ${id}` }));
            }
            if (!result || result.affected === 0) {
                throw AppError_1.AppError.notFound("การสั่งซื้อ");
            }
            return ApiResponse_1.ApiResponses.ok(res, { message: "การสั่งซื้อลบสำเร็จ" });
        }));
        this.confirmPurchase = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { id } = req.params;
            const { items } = req.body;
            const purchased_by_id = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.userId) || req.body.purchased_by_id;
            if (!items || !Array.isArray(items) || items.length === 0) {
                throw AppError_1.AppError.badRequest("ไม่พบข้อมูลสินค้า");
            }
            if (!purchased_by_id) {
                throw AppError_1.AppError.badRequest("ไม่พบข้อมูลผู้สั่งซื้อ");
            }
            const branch_id = (0, branch_middleware_1.getBranchId)(req);
            const oldOrder = yield this.ordersService.getOrderById(id, branch_id);
            const updatedOrder = yield this.ordersService.confirmPurchase(id, items, purchased_by_id, branch_id);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.STOCK_ORDER_CONFIRM_PURCHASE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "PurchaseOrder", entity_id: id, branch_id: branch_id, old_values: oldOrder, new_values: { items, purchased_by_id }, path: req.originalUrl, method: req.method, description: `Confirm purchase for stock order ${id}` }));
            return ApiResponse_1.ApiResponses.ok(res, updatedOrder);
        }));
    }
}
exports.OrdersController = OrdersController;
