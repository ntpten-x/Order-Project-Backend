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
exports.SalesOrderItemController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const ApiResponse_1 = require("../../utils/ApiResponse");
/**
 * Sales Order Item Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 */
class SalesOrderItemController {
    constructor(salesOrderItemService) {
        this.salesOrderItemService = salesOrderItemService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const items = yield this.salesOrderItemService.findAll();
            return ApiResponse_1.ApiResponses.ok(res, items);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const item = yield this.salesOrderItemService.findOne(req.params.id);
            if (!item) {
                throw AppError_1.AppError.notFound("รายการสินค้า");
            }
            return ApiResponse_1.ApiResponses.ok(res, item);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const item = yield this.salesOrderItemService.create(req.body);
            return ApiResponse_1.ApiResponses.created(res, item);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const item = yield this.salesOrderItemService.update(req.params.id, req.body);
            if (!item) {
                throw AppError_1.AppError.notFound("รายการสินค้า");
            }
            return ApiResponse_1.ApiResponses.ok(res, item);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            yield this.salesOrderItemService.delete(req.params.id);
            return ApiResponse_1.ApiResponses.ok(res, { message: "ลบรายการสินค้าในออเดอร์สำเร็จ" });
        }));
    }
}
exports.SalesOrderItemController = SalesOrderItemController;
