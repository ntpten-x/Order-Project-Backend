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
exports.updateShopProfile = exports.getShopProfile = void 0;
const shopProfile_service_1 = require("../../services/pos/shopProfile.service");
const shopProfile_model_1 = require("../../models/pos/shopProfile.model");
const branch_middleware_1 = require("../../middleware/branch.middleware");
const auditLogger_1 = require("../../utils/auditLogger");
const catchAsync_1 = require("../../utils/catchAsync");
const ApiResponse_1 = require("../../utils/ApiResponse");
const AppError_1 = require("../../utils/AppError");
const securityLogger_1 = require("../../utils/securityLogger");
const service = new shopProfile_service_1.ShopProfileService(new shopProfile_model_1.ShopProfileModels());
exports.getShopProfile = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const branchId = (0, branch_middleware_1.getBranchId)(req);
    if (!branchId)
        throw AppError_1.AppError.forbidden("Access denied: No branch assigned to user");
    const profile = yield service.getProfile(branchId);
    return ApiResponse_1.ApiResponses.ok(res, profile);
}));
exports.updateShopProfile = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const branchId = (0, branch_middleware_1.getBranchId)(req);
    if (!branchId)
        throw AppError_1.AppError.forbidden("Access denied: No branch assigned to user");
    const oldProfile = yield service.getProfile(branchId);
    req.body.branch_id = branchId;
    const profile = yield service.updateProfile(branchId, req.body);
    const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
    yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.SHOP_PROFILE_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "ShopProfile", entity_id: profile.id, branch_id: branchId, old_values: oldProfile, new_values: req.body, path: req.originalUrl, method: req.method, description: `Update shop profile ${profile.id}` }));
    return ApiResponse_1.ApiResponses.ok(res, profile);
}));
