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
const auditLogger_1 = require("../../utils/auditLogger");
const securityLogger_1 = require("../../utils/securityLogger");
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
            const is_active = (() => {
                const raw = req.query.is_active;
                if (raw === undefined || raw === null)
                    return undefined;
                if (Array.isArray(raw)) {
                    const first = raw[0];
                    if (typeof first !== "string")
                        return undefined;
                    if (first === "true")
                        return true;
                    if (first === "false")
                        return false;
                    return undefined;
                }
                if (typeof raw !== "string")
                    return undefined;
                if (raw === "")
                    return undefined;
                if (raw === "true")
                    return true;
                if (raw === "false")
                    return false;
                return undefined;
            })();
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const result = yield this.productsService.findAll(page, limit, category_id, q, is_active, branchId);
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
            var _a;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            if (req.body.price_delivery === undefined || req.body.price_delivery === null) {
                req.body.price_delivery = (_a = req.body.price) !== null && _a !== void 0 ? _a : 0;
            }
            const product = yield this.productsService.create(req.body);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.PRODUCT_CREATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Products", entity_id: product.id, branch_id: branchId, new_values: req.body, path: req.originalUrl, method: req.method, description: `Create product ${product.product_name || product.display_name || product.id}` }));
            return ApiResponse_1.ApiResponses.created(res, product);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const oldProduct = yield this.productsService.findOne(req.params.id, branchId);
            const product = yield this.productsService.update(req.params.id, req.body, branchId);
            if (product) {
                const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
                yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.PRODUCT_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Products", entity_id: req.params.id, branch_id: branchId, old_values: oldProduct, new_values: req.body, path: req.originalUrl, method: req.method, description: `Update product ${req.params.id}` }));
            }
            if (!product) {
                throw AppError_1.AppError.notFound("สินค้า");
            }
            return ApiResponse_1.ApiResponses.ok(res, product);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const oldProduct = yield this.productsService.findOne(req.params.id, branchId);
            yield this.productsService.delete(req.params.id, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.PRODUCT_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Products", entity_id: req.params.id, branch_id: branchId, old_values: oldProduct, path: req.originalUrl, method: req.method, description: `Delete product ${req.params.id}` }));
            return ApiResponse_1.ApiResponses.ok(res, { message: "สินค้าลบสำเร็จ" });
        }));
    }
}
exports.ProductsController = ProductsController;
