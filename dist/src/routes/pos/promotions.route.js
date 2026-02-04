"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ApiResponse_1 = require("../../utils/ApiResponse");
/**
 * Promotions feature has been removed in favor of Discounts.
 * This router remains as a stub to keep TypeScript builds stable.
 */
const router = (0, express_1.Router)();
router.all("*", (_req, res) => {
    return ApiResponse_1.ApiResponses.badRequest(res, "Promotions feature has been removed. Please use discounts instead.");
});
exports.default = router;
