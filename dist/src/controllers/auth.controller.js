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
exports.AuthController = void 0;
const database_1 = require("../database/database");
const Users_1 = require("../entity/Users");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class AuthController {
    static login(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password } = req.body;
            const userRepository = database_1.AppDataSource.getRepository(Users_1.Users);
            try {
                const user = yield userRepository.findOne({
                    where: { username },
                    relations: ["roles"]
                });
                if (!user) {
                    return res.status(401).json({ message: "ไม่พบข้อมูลผู้ใช้" });
                }
                // Check if user is disabled
                if (user.is_use === false) {
                    return res.status(403).json({ message: "บัญชีถูกปิด" });
                }
                // Compare password
                // Note: In a real app, passwords should be hashed. 
                // If the DB currently has plain text passwords, this might fail if we assume hash.
                // I'll assume they are hashed with bcrypt. If not, I'll check directly or we need to hash them.
                // For safety, I'll try bcrypt.compare, invalid if not hashed.
                const isMatch = yield bcrypt_1.default.compare(password, user.password);
                if (!isMatch) {
                    return res.status(401).json({ message: "ไม่พบข้อมูลผู้ใช้" });
                }
                // Generate Token
                const secret = process.env.JWT_SECRET || "default_secret_key";
                const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, role: user.roles.roles_name }, secret, { expiresIn: "10h" } // Token valid for 10 hours
                );
                // Set Cookie
                res.cookie("token", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production", // true in production
                    sameSite: "strict", // Protects against CSRF
                    maxAge: 36000000 // 10 hours in ms
                });
                // Update last_login_at
                user.last_login_at = new Date();
                yield userRepository.save(user);
                return res.status(200).json({
                    message: "เข้าสู่ระบบสำเร็จ",
                    user: {
                        id: user.id,
                        username: user.username,
                        role: user.roles.roles_name,
                        display_name: user.roles.display_name
                    }
                });
            }
            catch (error) {
                console.error("เกิดข้อผิดพลาดในการเข้าสู่ระบบ:", error);
                return res.status(500).json({ message: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" });
            }
        });
    }
    static logout(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            res.clearCookie("token");
            return res.status(200).json({ message: "ออกจากระบบสำเร็จ" });
        });
    }
    static getMe(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.user) {
                return res.status(401).json({ message: "ไม่พบข้อมูลผู้ใช้" });
            }
            const user = req.user;
            return res.json({
                id: user.id,
                username: user.username,
                role: user.roles ? user.roles.roles_name : "unknown",
                display_name: user.roles ? user.roles.display_name : user.username,
                is_active: user.is_active,
                is_use: user.is_use
            });
        });
    }
}
exports.AuthController = AuthController;
