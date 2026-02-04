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
exports.IngredientsUnitController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const branch_middleware_1 = require("../../middleware/branch.middleware");
const auditLogger_1 = require("../../utils/auditLogger");
const securityLogger_1 = require("../../utils/securityLogger");
/**
 * Ingredients Unit Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 * - Branch-based data isolation
 */
class IngredientsUnitController {
    constructor(ingredientsUnitService) {
        this.ingredientsUnitService = ingredientsUnitService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const ingredientsUnit = yield this.ingredientsUnitService.findAll(active !== undefined ? { is_active: active } : undefined, branchId);
            return ApiResponse_1.ApiResponses.ok(res, ingredientsUnit);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const ingredientsUnit = yield this.ingredientsUnitService.findOne(req.params.id, branchId);
            if (!ingredientsUnit) {
                throw AppError_1.AppError.notFound("หน่วยนับวัตถุดิบ");
            }
            return ApiResponse_1.ApiResponses.ok(res, ingredientsUnit);
        }));
        this.findOneByUnitName = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const ingredientsUnit = yield this.ingredientsUnitService.findOneByUnitName(req.params.unit_name, branchId);
            if (!ingredientsUnit) {
                throw AppError_1.AppError.notFound("หน่วยนับวัตถุดิบ");
            }
            return ApiResponse_1.ApiResponses.ok(res, ingredientsUnit);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const ingredientsUnit = yield this.ingredientsUnitService.create(req.body, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.STOCK_INGREDIENT_UNIT_CREATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "IngredientsUnit", entity_id: ingredientsUnit.id, branch_id: branchId, new_values: req.body, path: req.originalUrl, method: req.method, description: `Create ingredient unit ${ingredientsUnit.unit_name || ingredientsUnit.display_name || ingredientsUnit.id}` }));
            return ApiResponse_1.ApiResponses.created(res, ingredientsUnit);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const oldIngredientsUnit = yield this.ingredientsUnitService.findOne(req.params.id, branchId);
            const ingredientsUnit = yield this.ingredientsUnitService.update(req.params.id, req.body, branchId);
            if (ingredientsUnit) {
                const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
                yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.STOCK_INGREDIENT_UNIT_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "IngredientsUnit", entity_id: req.params.id, branch_id: branchId, old_values: oldIngredientsUnit, new_values: req.body, path: req.originalUrl, method: req.method, description: `Update ingredient unit ${req.params.id}` }));
            }
            if (!ingredientsUnit) {
                throw AppError_1.AppError.notFound("หน่วยนับวัตถุดิบ");
            }
            return ApiResponse_1.ApiResponses.ok(res, ingredientsUnit);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const oldIngredientsUnit = yield this.ingredientsUnitService.findOne(req.params.id, branchId);
            yield this.ingredientsUnitService.delete(req.params.id, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.STOCK_INGREDIENT_UNIT_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "IngredientsUnit", entity_id: req.params.id, branch_id: branchId, old_values: oldIngredientsUnit, path: req.originalUrl, method: req.method, description: `Delete ingredient unit ${req.params.id}` }));
            return ApiResponse_1.ApiResponses.ok(res, { message: "หน่วยนับวัตถุดิบลบสำเร็จ" });
        }));
    }
}
exports.IngredientsUnitController = IngredientsUnitController;
