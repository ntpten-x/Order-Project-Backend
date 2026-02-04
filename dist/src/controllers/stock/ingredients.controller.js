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
exports.IngredientsController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const branch_middleware_1 = require("../../middleware/branch.middleware");
const auditLogger_1 = require("../../utils/auditLogger");
const securityLogger_1 = require("../../utils/securityLogger");
/**
 * Ingredients Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling with catchAsync
 * - Proper error codes
 * - Branch-based data isolation
 */
class IngredientsController {
    constructor(ingredientsService) {
        this.ingredientsService = ingredientsService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const ingredients = yield this.ingredientsService.findAll(active !== undefined ? { is_active: active } : undefined, branchId);
            return ApiResponse_1.ApiResponses.ok(res, ingredients);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const ingredient = yield this.ingredientsService.findOne(req.params.id, branchId);
            if (!ingredient) {
                throw AppError_1.AppError.notFound("วัตถุดิบ");
            }
            return ApiResponse_1.ApiResponses.ok(res, ingredient);
        }));
        this.findOneByName = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const ingredient = yield this.ingredientsService.findOneByName(req.params.ingredient_name, branchId);
            if (!ingredient) {
                throw AppError_1.AppError.notFound("วัตถุดิบ");
            }
            return ApiResponse_1.ApiResponses.ok(res, ingredient);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const ingredient = yield this.ingredientsService.create(req.body);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.STOCK_INGREDIENT_CREATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Ingredients", entity_id: ingredient.id, branch_id: branchId, new_values: req.body, path: req.originalUrl, method: req.method, description: `Create ingredient ${ingredient.ingredient_name || ingredient.display_name || ingredient.id}` }));
            return ApiResponse_1.ApiResponses.created(res, ingredient);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const oldIngredient = yield this.ingredientsService.findOne(req.params.id, branchId);
            const ingredient = yield this.ingredientsService.update(req.params.id, req.body, branchId);
            if (ingredient) {
                const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
                yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.STOCK_INGREDIENT_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Ingredients", entity_id: req.params.id, branch_id: branchId, old_values: oldIngredient, new_values: req.body, path: req.originalUrl, method: req.method, description: `Update ingredient ${req.params.id}` }));
            }
            if (!ingredient) {
                throw AppError_1.AppError.notFound("วัตถุดิบ");
            }
            return ApiResponse_1.ApiResponses.ok(res, ingredient);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const oldIngredient = yield this.ingredientsService.findOne(req.params.id, branchId);
            yield this.ingredientsService.delete(req.params.id, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.STOCK_INGREDIENT_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Ingredients", entity_id: req.params.id, branch_id: branchId, old_values: oldIngredient, path: req.originalUrl, method: req.method, description: `Delete ingredient ${req.params.id}` }));
            return ApiResponse_1.ApiResponses.ok(res, { message: "วัตถุดิบลบสำเร็จ" });
        }));
    }
}
exports.IngredientsController = IngredientsController;
