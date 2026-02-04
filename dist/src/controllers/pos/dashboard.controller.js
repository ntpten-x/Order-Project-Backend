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
exports.DashboardController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const branch_middleware_1 = require("../../middleware/branch.middleware");
const ApiResponse_1 = require("../../utils/ApiResponse");
class DashboardController {
    constructor(dashboardService) {
        this.dashboardService = dashboardService;
        this.getSalesSummary = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { startDate, endDate } = req.query;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const result = yield this.dashboardService.getSalesSummary(startDate, endDate, branchId);
            return ApiResponse_1.ApiResponses.ok(res, result);
        }));
        this.getTopSellingItems = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const limit = parseInt(req.query.limit) || 10;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const result = yield this.dashboardService.getTopSellingItems(limit, branchId);
            return ApiResponse_1.ApiResponses.ok(res, result);
        }));
    }
}
exports.DashboardController = DashboardController;
