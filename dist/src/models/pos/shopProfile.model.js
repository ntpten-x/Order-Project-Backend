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
const database_1 = require("../../database/database");
const ShopProfile_1 = require("../../entity/pos/ShopProfile");
class ShopProfileModels {
    constructor() {
        this.repo = database_1.AppDataSource.getRepository(ShopProfile_1.ShopProfile);
    }
    // Get the first profile (assuming single shop for now)
    getProfile() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.repo.findOne({ where: {} });
        });
    }
    createOrUpdate(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield this.getProfile();
            if (existing) {
                yield this.repo.update(existing.id, data);
                return this.repo.findOneBy({ id: existing.id });
            }
            const newProfile = this.repo.create(data);
            return this.repo.save(newProfile);
        });
    }
}
exports.ShopProfileModels = ShopProfileModels;
