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
exports.PromotionsService = void 0;
const AppError_1 = require("../../utils/AppError");
const removedMessage = "Promotions feature has been removed. Please use discounts instead.";
/**
 * Promotions feature has been removed in favor of Discounts.
 * This service remains as a stub to keep TypeScript builds stable.
 */
class PromotionsService {
    validatePromotionCode() {
        return __awaiter(this, void 0, void 0, function* () {
            return { eligible: false, discountAmount: 0, message: removedMessage };
        });
    }
    applyPromotion() {
        return __awaiter(this, void 0, void 0, function* () {
            throw AppError_1.AppError.badRequest(removedMessage);
        });
    }
    getActivePromotions() {
        return __awaiter(this, void 0, void 0, function* () {
            return [];
        });
    }
    getAll() {
        return __awaiter(this, void 0, void 0, function* () {
            return [];
        });
    }
    getById() {
        return __awaiter(this, void 0, void 0, function* () {
            return null;
        });
    }
    create() {
        return __awaiter(this, void 0, void 0, function* () {
            throw AppError_1.AppError.badRequest(removedMessage);
        });
    }
    update() {
        return __awaiter(this, void 0, void 0, function* () {
            throw AppError_1.AppError.badRequest(removedMessage);
        });
    }
    delete() {
        return __awaiter(this, void 0, void 0, function* () {
            throw AppError_1.AppError.badRequest(removedMessage);
        });
    }
}
exports.PromotionsService = PromotionsService;
