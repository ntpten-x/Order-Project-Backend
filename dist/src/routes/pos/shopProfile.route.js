"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const shopProfile_controller_1 = require("../../controllers/pos/shopProfile.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const posMaster_schema_1 = require("../../utils/schemas/posMaster.schema");
const router = express_1.default.Router();
router.use(auth_middleware_1.authenticateToken);
router.get("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager", "Employee"]), shopProfile_controller_1.getShopProfile);
router.put("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), (0, validate_middleware_1.validate)(posMaster_schema_1.updateShopProfileSchema), shopProfile_controller_1.updateShopProfile);
router.post("/", (0, auth_middleware_1.authorizeRole)(["Admin", "Manager"]), (0, validate_middleware_1.validate)(posMaster_schema_1.updateShopProfileSchema), shopProfile_controller_1.updateShopProfile); // Allow POST as update too
exports.default = router;
