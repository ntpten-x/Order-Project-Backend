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
exports.ShopProfileModels = void 0;
const ShopProfile_1 = require("../../entity/pos/ShopProfile");
const dbContext_1 = require("../../database/dbContext");
class ShopProfileModels {
    getProfile(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, dbContext_1.getRepository)(ShopProfile_1.ShopProfile).findOne({ where: { branch_id: branchId } });
        });
    }
    createOrUpdate(branchId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = (0, dbContext_1.getRepository)(ShopProfile_1.ShopProfile);
            const existing = yield this.getProfile(branchId);
            if (existing) {
                yield repo.update(existing.id, Object.assign(Object.assign({}, data), { branch_id: branchId }));
                return repo.findOneBy({ id: existing.id });
            }
            const newProfile = repo.create(Object.assign(Object.assign({}, data), { branch_id: branchId }));
            return repo.save(newProfile);
        });
    }
}
exports.ShopProfileModels = ShopProfileModels;
