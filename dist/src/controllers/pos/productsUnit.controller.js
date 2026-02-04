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
exports.ProductsUnitController = void 0;
const branch_middleware_1 = require("../../middleware/branch.middleware");
const catchAsync_1 = require("../../utils/catchAsync");
const ApiResponse_1 = require("../../utils/ApiResponse");
const AppError_1 = require("../../utils/AppError");
const auditLogger_1 = require("../../utils/auditLogger");
const securityLogger_1 = require("../../utils/securityLogger");
class ProductsUnitController {
    constructor(productsUnitService) {
        this.productsUnitService = productsUnitService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const productsUnits = yield this.productsUnitService.findAll(branchId);
            return ApiResponse_1.ApiResponses.ok(res, productsUnits);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const productsUnit = yield this.productsUnitService.findOne(req.params.id, branchId);
            if (!productsUnit)
                throw AppError_1.AppError.notFound("Products unit");
            return ApiResponse_1.ApiResponses.ok(res, productsUnit);
        }));
        this.findOneByName = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const productsUnit = yield this.productsUnitService.findOneByName(req.params.products_unit_name, branchId);
            if (!productsUnit)
                throw AppError_1.AppError.notFound("Products unit");
            return ApiResponse_1.ApiResponses.ok(res, productsUnit);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const productsUnit = yield this.productsUnitService.create(req.body, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.PRODUCTS_UNIT_CREATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "ProductsUnit", entity_id: productsUnit.id, branch_id: branchId, new_values: req.body, path: req.originalUrl, method: req.method, description: `Create products unit ${productsUnit.products_unit_name || productsUnit.display_name || productsUnit.id}` }));
            return ApiResponse_1.ApiResponses.created(res, productsUnit);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const oldProductsUnit = yield this.productsUnitService.findOne(req.params.id, branchId);
            const productsUnit = yield this.productsUnitService.update(req.params.id, req.body, branchId);
            if (productsUnit) {
                const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
                yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.PRODUCTS_UNIT_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "ProductsUnit", entity_id: req.params.id, branch_id: branchId, old_values: oldProductsUnit, new_values: req.body, path: req.originalUrl, method: req.method, description: `Update products unit ${req.params.id}` }));
            }
            return ApiResponse_1.ApiResponses.ok(res, productsUnit);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            /* try {
                const branchId = getBranchId(req as any);
                await this.productsUnitService.delete(req.params.id, branchId)
                res.status(200).json({ message: "หน่วยสินค้าลบสำเร็จ" })
            } catch (error: any) {
                res.status(500).json({ error: error.message })
            } */
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const oldProductsUnit = yield this.productsUnitService.findOne(req.params.id, branchId);
            yield this.productsUnitService.delete(req.params.id, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.PRODUCTS_UNIT_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "ProductsUnit", entity_id: req.params.id, branch_id: branchId, old_values: oldProductsUnit, path: req.originalUrl, method: req.method, description: `Delete products unit ${req.params.id}` }));
            return ApiResponse_1.ApiResponses.noContent(res);
        }));
    }
}
exports.ProductsUnitController = ProductsUnitController;
