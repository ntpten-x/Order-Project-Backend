"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkActiveObj = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const checkActiveObj = (req, res, next) => {
    if (!req.user) {
        return ApiResponse_1.ApiResponses.unauthorized(res, "Authentication required");
    }
    if (req.user.is_use === false) {
        return ApiResponse_1.ApiResponses.forbidden(res, "Account disabled. Please contact administrator.");
    }
    next();
};
exports.checkActiveObj = checkActiveObj;
