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
exports.ProductsController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const branch_middleware_1 = require("../../middleware/branch.middleware");
/**
 * Products Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 * - Pagination support
 * - Branch-based data isolation
 */
class ProductsController {
    constructor(productsService) {
        this.productsService = productsService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const rawLimit = parseInt(req.query.limit);
            const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
            const category_id = req.query.category_id;
            const q = req.query.q || undefined;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const result = yield this.productsService.findAll(page, limit, category_id, q, branchId);
            return ApiResponse_1.ApiResponses.paginated(res, result.data, {
                page: result.page,
                limit: limit,
                total: result.total,
            });
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const product = yield this.productsService.findOne(req.params.id, branchId);
            if (!product) {
                throw AppError_1.AppError.notFound("สินค้า");
            }
            return ApiResponse_1.ApiResponses.ok(res, product);
        }));
        this.findOneByName = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const product = yield this.productsService.findOneByName(req.params.product_name, branchId);
            if (!product) {
                throw AppError_1.AppError.notFound("สินค้า");
            }
            return ApiResponse_1.ApiResponses.ok(res, product);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId && !req.body.branch_id) {
                req.body.branch_id = branchId;
            }
            const product = yield this.productsService.create(req.body);
            return ApiResponse_1.ApiResponses.created(res, product);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const product = yield this.productsService.update(req.params.id, req.body);
            if (!product) {
                throw AppError_1.AppError.notFound("สินค้า");
            }
            return ApiResponse_1.ApiResponses.ok(res, product);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            yield this.productsService.delete(req.params.id);
            return ApiResponse_1.ApiResponses.ok(res, { message: "สินค้าลบสำเร็จ" });
        }));
    }
}
exports.ProductsController = ProductsController;
