"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const shopProfile_controller_1 = require("../../controllers/pos/shopProfile.controller");
const router = express_1.default.Router();
router.get("/", shopProfile_controller_1.getShopProfile);
router.put("/", shopProfile_controller_1.updateShopProfile);
router.post("/", shopProfile_controller_1.updateShopProfile); // Allow POST as update too
exports.default = router;
