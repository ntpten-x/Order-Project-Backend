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
exports.DiscountsController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const branch_middleware_1 = require("../../middleware/branch.middleware");
class DiscountsController {
    constructor(discountsService) {
        this.discountsService = discountsService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const q = req.query.q || undefined;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const discounts = yield this.discountsService.findAll(q, branchId);
            return ApiResponse_1.ApiResponses.ok(res, discounts);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const discount = yield this.discountsService.findOne(req.params.id, branchId);
            if (!discount) {
                throw AppError_1.AppError.notFound("ส่วนลด");
            }
            return ApiResponse_1.ApiResponses.ok(res, discount);
        }));
        this.findByName = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const discount = yield this.discountsService.findOneByName(req.params.name, branchId);
            if (!discount) {
                throw AppError_1.AppError.notFound("ส่วนลด");
            }
            return ApiResponse_1.ApiResponses.ok(res, discount);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId && !req.body.branch_id) {
                req.body.branch_id = branchId;
            }
            const discount = yield this.discountsService.create(req.body);
            return ApiResponse_1.ApiResponses.created(res, discount);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const discount = yield this.discountsService.update(req.params.id, req.body);
            if (!discount) {
                throw AppError_1.AppError.notFound("ส่วนลด");
            }
            return ApiResponse_1.ApiResponses.ok(res, discount);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            yield this.discountsService.delete(req.params.id);
            return ApiResponse_1.ApiResponses.ok(res, { message: "ลบข้อมูลส่วนลดสำเร็จ" });
        }));
    }
}
exports.DiscountsController = DiscountsController;
