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
exports.TablesController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const ApiResponse_1 = require("../../utils/ApiResponse");
/**
 * Tables Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 * - Pagination support
 */
class TablesController {
    constructor(tablesService) {
        this.tablesService = tablesService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const rawLimit = parseInt(req.query.limit);
            const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
            const q = req.query.q || undefined;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            const result = yield this.tablesService.findAll(page, limit, q, branchId);
            // Check if result has pagination structure
            if (result.data && result.total !== undefined) {
                return ApiResponse_1.ApiResponses.paginated(res, result.data, {
                    page: result.page || page,
                    limit: limit,
                    total: result.total,
                });
            }
            return ApiResponse_1.ApiResponses.ok(res, result);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const table = yield this.tablesService.findOne(req.params.id);
            if (!table) {
                throw AppError_1.AppError.notFound("โต๊ะ");
            }
            return ApiResponse_1.ApiResponses.ok(res, table);
        }));
        this.findByName = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const table = yield this.tablesService.findOneByName(req.params.name);
            if (!table) {
                throw AppError_1.AppError.notFound("โต๊ะ");
            }
            return ApiResponse_1.ApiResponses.ok(res, table);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            if (branchId && !req.body.branch_id) {
                req.body.branch_id = branchId;
            }
            const table = yield this.tablesService.create(req.body);
            return ApiResponse_1.ApiResponses.created(res, table);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const table = yield this.tablesService.update(req.params.id, req.body);
            if (!table) {
                throw AppError_1.AppError.notFound("โต๊ะ");
            }
            return ApiResponse_1.ApiResponses.ok(res, table);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            yield this.tablesService.delete(req.params.id);
            return ApiResponse_1.ApiResponses.ok(res, { message: "ลบข้อมูลโต๊ะสำเร็จ" });
        }));
    }
}
exports.TablesController = TablesController;
