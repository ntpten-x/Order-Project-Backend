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
exports.DeliveryController = void 0;
const branch_middleware_1 = require("../../middleware/branch.middleware");
const catchAsync_1 = require("../../utils/catchAsync");
const ApiResponse_1 = require("../../utils/ApiResponse");
const AppError_1 = require("../../utils/AppError");
const auditLogger_1 = require("../../utils/auditLogger");
const securityLogger_1 = require("../../utils/securityLogger");
class DeliveryController {
    constructor(deliveryService) {
        this.deliveryService = deliveryService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const rawLimit = parseInt(req.query.limit);
            const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
            const q = req.query.q || undefined;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const result = yield this.deliveryService.findAll(page, limit, q, branchId);
            return ApiResponse_1.ApiResponses.paginated(res, result.data, {
                page: result.page,
                limit,
                total: result.total,
            });
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const delivery = yield this.deliveryService.findOne(req.params.id, branchId);
            if (!delivery)
                throw AppError_1.AppError.notFound("Delivery");
            return ApiResponse_1.ApiResponses.ok(res, delivery);
        }));
        this.findByName = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const delivery = yield this.deliveryService.findOneByName(req.params.name, branchId);
            if (!delivery)
                throw AppError_1.AppError.notFound("Delivery");
            return ApiResponse_1.ApiResponses.ok(res, delivery);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const delivery = yield this.deliveryService.create(req.body);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.DELIVERY_CREATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Delivery", entity_id: delivery.id, branch_id: branchId, new_values: req.body, path: req.originalUrl, method: req.method, description: `Create delivery ${delivery.delivery_name || delivery.id}` }));
            return ApiResponse_1.ApiResponses.created(res, delivery);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const oldDelivery = yield this.deliveryService.findOne(req.params.id, branchId);
            const delivery = yield this.deliveryService.update(req.params.id, req.body, branchId);
            if (delivery) {
                const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
                yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.DELIVERY_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Delivery", entity_id: req.params.id, branch_id: branchId, old_values: oldDelivery, new_values: req.body, path: req.originalUrl, method: req.method, description: `Update delivery ${req.params.id}` }));
            }
            return ApiResponse_1.ApiResponses.ok(res, delivery);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            /* try {
                const branchId = getBranchId(req as any);
                await this.deliveryService.delete(req.params.id, branchId)
                res.status(200).json({ message: "ลบข้อมูลบริการส่งสำเร็จ" })
            } catch (error: any) {
                res.status(500).json({ error: error.message })
            } */
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const oldDelivery = yield this.deliveryService.findOne(req.params.id, branchId);
            yield this.deliveryService.delete(req.params.id, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.DELIVERY_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Delivery", entity_id: req.params.id, branch_id: branchId, old_values: oldDelivery, path: req.originalUrl, method: req.method, description: `Delete delivery ${req.params.id}` }));
            return ApiResponse_1.ApiResponses.noContent(res);
        }));
    }
}
exports.DeliveryController = DeliveryController;
