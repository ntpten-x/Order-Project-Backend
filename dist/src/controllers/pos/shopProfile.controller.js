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
const service = new shopProfile_service_1.ShopProfileService(new shopProfile_model_1.ShopProfileModels());
const getShopProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const profile = yield service.getProfile();
        res.json(profile);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getShopProfile = getShopProfile;
const updateShopProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const profile = yield service.updateProfile(req.body);
        res.json(profile);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.updateShopProfile = updateShopProfile;
