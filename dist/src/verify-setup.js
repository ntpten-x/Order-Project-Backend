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
const database_1 = require("./database/database");
const Users_1 = require("./entity/Users");
const Roles_1 = require("./entity/Roles");
const bcrypt_1 = __importDefault(require("bcrypt"));
const seed = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, database_1.connectDatabase)();
    const roleRepo = database_1.AppDataSource.getRepository(Roles_1.Roles);
    const userRepo = database_1.AppDataSource.getRepository(Users_1.Users);
    // 1. Ensure Roles
    const roles = ["admin", "manager", "employee"];
    const roleMap = {};
    for (const r of roles) {
        let role = yield roleRepo.findOne({ where: { roles_name: r } });
        if (!role) {
            console.log(`Creating role: ${r}`);
            role = new Roles_1.Roles();
            role.roles_name = r;
            role.display_name = r.charAt(0).toUpperCase() + r.slice(1);
            yield roleRepo.save(role);
        }
        roleMap[r] = role;
    }
    // 2. Ensure Users
    const users = [
        { username: "admin", role: "admin" },
        { username: "manager", role: "manager" },
        { username: "employee", role: "employee" },
        { username: "banned", role: "employee", is_use: false }
    ];
    for (const u of users) {
        let user = yield userRepo.findOne({ where: { username: u.username } });
        if (!user) {
            console.log(`Creating user: ${u.username}`);
            user = new Users_1.Users();
            user.username = u.username;
            // Hash password
            const salt = yield bcrypt_1.default.genSalt(10);
            user.password = yield bcrypt_1.default.hash("password", salt);
            user.roles = roleMap[u.role];
            user.is_use = u.is_use !== undefined ? u.is_use : true;
            user.is_active = false;
            yield userRepo.save(user);
        }
        else {
            // Ensure checking password matches 'password' logic might be needed if you want to test login, 
            // but we won't overwrite existing users' passwords to avoid data loss.
            // We'll assume if we created them, they are 'password'.
            console.log(`User ${u.username} already exists`);
        }
    }
    console.log("Seed complete. Test users: admin/password, manager/password, employee/password, banned/password");
    process.exit(0);
});
seed();
