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
exports.CategoryController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const branch_middleware_1 = require("../../middleware/branch.middleware");
/**
 * Category Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 * - Branch-based data isolation
 */
class CategoryController {
    constructor(categoryService) {
        this.categoryService = categoryService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const categories = yield this.categoryService.findAll(branchId);
            return ApiResponse_1.ApiResponses.ok(res, categories);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const category = yield this.categoryService.findOne(req.params.id, branchId);
            if (!category) {
                throw AppError_1.AppError.notFound("หมวดหมู่");
            }
            return ApiResponse_1.ApiResponses.ok(res, category);
        }));
        this.findOneByName = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const category = yield this.categoryService.findOneByName(req.params.category_name, branchId);
            if (!category) {
                throw AppError_1.AppError.notFound("หมวดหมู่");
            }
            return ApiResponse_1.ApiResponses.ok(res, category);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId && !req.body.branch_id) {
                req.body.branch_id = branchId;
            }
            const category = yield this.categoryService.create(req.body);
            return ApiResponse_1.ApiResponses.created(res, category);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const category = yield this.categoryService.update(req.params.id, req.body);
            if (!category) {
                throw AppError_1.AppError.notFound("หมวดหมู่");
            }
            return ApiResponse_1.ApiResponses.ok(res, category);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            yield this.categoryService.delete(req.params.id);
            return ApiResponse_1.ApiResponses.ok(res, { message: "หมวดหมู่ลบสำเร็จ" });
        }));
    }
}
exports.CategoryController = CategoryController;
