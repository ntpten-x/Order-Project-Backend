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
            var _a;
            const { ordered_by_id, items, remark } = req.body;
            const branch_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            // Validate input
            if (!ordered_by_id || !items || !Array.isArray(items) || items.length === 0) {
                throw AppError_1.AppError.badRequest("ไม่พบข้อมูลการสั่งซื้อ");
            }
            const order = yield this.ordersService.createOrder(ordered_by_id, items, remark, branch_id);
            return ApiResponse_1.ApiResponses.created(res, order);
        }));
        this.getAllOrders = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
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
            const branch_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            const result = yield this.ordersService.getAllOrders(statusFilter ? { status: statusFilter } : undefined, page, limit, branch_id);
            return ApiResponse_1.ApiResponses.paginated(res, result.data, {
                page: result.page,
                limit: result.limit,
                total: result.total,
            });
        }));
        this.getOrderById = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const order = yield this.ordersService.getOrderById(id);
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
            const updatedOrder = yield this.ordersService.updateOrder(id, items);
            return ApiResponse_1.ApiResponses.ok(res, updatedOrder);
        }));
        this.updateStatus = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { status } = req.body;
            if (!status || !Object.values(PurchaseOrder_1.PurchaseOrderStatus).includes(status)) {
                throw AppError_1.AppError.badRequest("สถานะไม่ถูกต้อง");
            }
            const updatedOrder = yield this.ordersService.updateStatus(id, status);
            return ApiResponse_1.ApiResponses.ok(res, updatedOrder);
        }));
        this.deleteOrder = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const result = yield this.ordersService.deleteOrder(id);
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
            const updatedOrder = yield this.ordersService.confirmPurchase(id, items, purchased_by_id);
            return ApiResponse_1.ApiResponses.ok(res, updatedOrder);
        }));
    }
}
exports.OrdersController = OrdersController;
