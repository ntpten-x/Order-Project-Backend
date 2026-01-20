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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../database/database");
const Users_1 = require("../entity/Users");
const authenticateToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // 1. Get token from cookies
    let token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token;
    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }
    }
    if (!token) {
        // Allow public access or just fail? Usually middleware blocks.
        return res.status(401).json({ message: "Authentication required" });
    }
    try {
        // 2. Verify token
        const secret = process.env.JWT_SECRET || "default_secret_key";
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        // 3. Attach user to request
        const userRepository = database_1.AppDataSource.getRepository(Users_1.Users);
        const user = yield userRepository.findOne({
            where: { id: decoded.id },
            relations: ["roles"]
        });
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }
        req.user = user;
        next();
    }
    catch (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
    }
});
exports.authenticateToken = authenticateToken;
const authorizeRole = (allowedRoles) => {
    return (req, res, next) => {
        var _a;
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }
        const userRole = (_a = req.user.roles) === null || _a === void 0 ? void 0 : _a.roles_name;
        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).json({ message: "Access denied: Insufficient permissions" });
        }
        next();
    };
};
exports.authorizeRole = authorizeRole;
