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
exports.PromotionsController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const ApiResponse_1 = require("../../utils/ApiResponse");
/**
 * Promotions feature has been removed in favor of Discounts.
 * This controller remains as a stub to keep TypeScript builds stable.
 */
class PromotionsController {
    constructor() {
        this.removedMessage = "Promotions feature has been removed. Please use discounts instead.";
        this.validatePromotion = (0, catchAsync_1.catchAsync)((_req, res) => __awaiter(this, void 0, void 0, function* () {
            return ApiResponse_1.ApiResponses.badRequest(res, this.removedMessage);
        }));
        this.applyPromotion = (0, catchAsync_1.catchAsync)((_req, res) => __awaiter(this, void 0, void 0, function* () {
            return ApiResponse_1.ApiResponses.badRequest(res, this.removedMessage);
        }));
        this.getActivePromotions = (0, catchAsync_1.catchAsync)((_req, res) => __awaiter(this, void 0, void 0, function* () {
            return ApiResponse_1.ApiResponses.ok(res, []);
        }));
        this.getAll = (0, catchAsync_1.catchAsync)((_req, res) => __awaiter(this, void 0, void 0, function* () {
            return ApiResponse_1.ApiResponses.ok(res, []);
        }));
        this.getById = (0, catchAsync_1.catchAsync)((_req, res) => __awaiter(this, void 0, void 0, function* () {
            return ApiResponse_1.ApiResponses.notFound(res, "Promotion");
        }));
        this.create = (0, catchAsync_1.catchAsync)((_req, res) => __awaiter(this, void 0, void 0, function* () {
            return ApiResponse_1.ApiResponses.badRequest(res, this.removedMessage);
        }));
        this.update = (0, catchAsync_1.catchAsync)((_req, res) => __awaiter(this, void 0, void 0, function* () {
            return ApiResponse_1.ApiResponses.badRequest(res, this.removedMessage);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((_req, res) => __awaiter(this, void 0, void 0, function* () {
            return ApiResponse_1.ApiResponses.badRequest(res, this.removedMessage);
        }));
    }
}
exports.PromotionsController = PromotionsController;
