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
exports.PromotionsController = void 0;
const promotions_service_1 = require("../../services/pos/promotions.service");
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const ApiResponse_1 = require("../../utils/ApiResponse");
class PromotionsController {
    constructor() {
        this.promotionsService = new promotions_service_1.PromotionsService();
        /**
         * Validate promotion code
         */
        this.validatePromotion = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { code, orderItems, totalAmount } = req.body;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            if (!code) {
                throw AppError_1.AppError.badRequest("Promotion code is required");
            }
            if (!orderItems || !Array.isArray(orderItems)) {
                throw AppError_1.AppError.badRequest("Order items are required");
            }
            const result = yield this.promotionsService.validatePromotionCode(code, orderItems, totalAmount || 0, branchId);
            return ApiResponse_1.ApiResponses.ok(res, result);
        }));
        /**
         * Apply promotion
         */
        this.applyPromotion = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { code } = req.body;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            if (!code) {
                throw AppError_1.AppError.badRequest("Promotion code is required");
            }
            const promotion = yield this.promotionsService.applyPromotion(code, branchId);
            return ApiResponse_1.ApiResponses.ok(res, promotion);
        }));
        /**
         * Get active promotions
         */
        this.getActivePromotions = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            const promotions = yield this.promotionsService.getActivePromotions(branchId);
            return ApiResponse_1.ApiResponses.ok(res, promotions);
        }));
        /**
         * Get all promotions
         */
        this.getAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
            const promotions = yield this.promotionsService.getAll(branchId, isActive);
            return ApiResponse_1.ApiResponses.ok(res, promotions);
        }));
        /**
         * Get promotion by ID
         */
        this.getById = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id } = req.params;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            const promotion = yield this.promotionsService.getById(id, branchId);
            if (!promotion) {
                throw AppError_1.AppError.notFound("Promotion not found");
            }
            return ApiResponse_1.ApiResponses.ok(res, promotion);
        }));
        /**
         * Create promotion
         */
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            if (!req.body.promotion_code) {
                throw AppError_1.AppError.badRequest("Promotion code is required");
            }
            if (!req.body.name) {
                throw AppError_1.AppError.badRequest("Promotion name is required");
            }
            if (!req.body.promotion_type) {
                throw AppError_1.AppError.badRequest("Promotion type is required");
            }
            if (!req.body.condition_type) {
                throw AppError_1.AppError.badRequest("Condition type is required");
            }
            const promotion = yield this.promotionsService.create(req.body, branchId);
            return ApiResponse_1.ApiResponses.created(res, promotion);
        }));
        /**
         * Update promotion
         */
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id } = req.params;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            const promotion = yield this.promotionsService.update(id, req.body, branchId);
            if (!promotion) {
                throw AppError_1.AppError.notFound("Promotion not found");
            }
            return ApiResponse_1.ApiResponses.ok(res, promotion);
        }));
        /**
         * Delete promotion
         */
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id } = req.params;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            yield this.promotionsService.delete(id, branchId);
            return ApiResponse_1.ApiResponses.ok(res, { message: "Promotion deleted successfully" });
        }));
    }
}
exports.PromotionsController = PromotionsController;
