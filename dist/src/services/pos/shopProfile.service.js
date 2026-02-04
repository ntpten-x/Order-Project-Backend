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
exports.ShopProfileService = void 0;
class ShopProfileService {
    constructor(model) {
        this.model = model;
    }
    getProfile(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            let profile = yield this.model.getProfile(branchId);
            if (!profile) {
                // Create default if not exists
                profile = yield this.model.createOrUpdate(branchId, {
                    shop_name: "POS Shop"
                });
            }
            return profile;
        });
    }
    updateProfile(branchId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.model.createOrUpdate(branchId, data);
        });
    }
}
exports.ShopProfileService = ShopProfileService;
