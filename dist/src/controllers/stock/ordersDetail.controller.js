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
exports.OrdersDetailController = void 0;
const ordersDetail_service_1 = require("../../services/stock/ordersDetail.service");
const ordersDetail_model_1 = require("../../models/stock/ordersDetail.model");
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const ApiResponse_1 = require("../../utils/ApiResponse");
/**
 * Orders Detail Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 */
class OrdersDetailController {
    constructor() {
        this.ordersDetailModel = new ordersDetail_model_1.StockOrdersDetailModel();
        this.ordersDetailService = new ordersDetail_service_1.OrdersDetailService(this.ordersDetailModel);
        this.updatePurchase = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { orders_item_id, actual_quantity, purchased_by_id, is_purchased } = req.body;
            if (!orders_item_id || !purchased_by_id) {
                throw AppError_1.AppError.badRequest("ไม่พบข้อมูลสินค้าหรือผู้สั่งซื้อ");
            }
            const result = yield this.ordersDetailService.updatePurchaseDetail(orders_item_id, {
                actual_quantity,
                purchased_by_id,
                is_purchased: is_purchased !== null && is_purchased !== void 0 ? is_purchased : true
            });
            return ApiResponse_1.ApiResponses.ok(res, result);
        }));
    }
}
exports.OrdersDetailController = OrdersDetailController;
