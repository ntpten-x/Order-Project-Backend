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
exports.UsersModels = void 0;
const Users_1 = require("../entity/Users");
const dbContext_1 = require("../database/dbContext");
class UsersModels {
    findAll(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const usersRepository = (0, dbContext_1.getRepository)(Users_1.Users);
                const ctx = (0, dbContext_1.getDbContext)();
                const query = usersRepository.createQueryBuilder("users")
                    .leftJoinAndSelect("users.roles", "roles")
                    .leftJoinAndSelect("users.branch", "branch")
                    .orderBy("users.is_active", "DESC")
                    .addOrderBy("users.create_date", "ASC");
                if (filters === null || filters === void 0 ? void 0 : filters.role) {
                    query.where("roles.roles_name = :role", { role: filters.role });
                }
                // Respect active branch context (e.g. Admin switching branch) when present.
                if (ctx === null || ctx === void 0 ? void 0 : ctx.branchId) {
                    query.andWhere("users.branch_id = :branchId", { branchId: ctx.branchId });
                }
                return yield query.getMany();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const ctx = (0, dbContext_1.getDbContext)();
                const query = (0, dbContext_1.getRepository)(Users_1.Users).createQueryBuilder("users")
                    .leftJoinAndSelect("users.roles", "roles")
                    .leftJoinAndSelect("users.branch", "branch")
                    .where("users.id = :id", { id });
                if (ctx === null || ctx === void 0 ? void 0 : ctx.branchId) {
                    query.andWhere("users.branch_id = :branchId", { branchId: ctx.branchId });
                }
                return yield query.getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByUsername(username) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Username is globally unique; do not apply branch scoping here.
                return (0, dbContext_1.getRepository)(Users_1.Users).createQueryBuilder("users")
                    .leftJoinAndSelect("users.roles", "roles")
                    .leftJoinAndSelect("users.branch", "branch")
                    .where("users.username = :username", { username })
                    .getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(users) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const ctx = (0, dbContext_1.getDbContext)();
                // If an active branch context exists (Admin switched branch), force the user into that branch.
                if (ctx === null || ctx === void 0 ? void 0 : ctx.branchId) {
                    users.branch_id = ctx.branchId;
                }
                return (0, dbContext_1.getRepository)(Users_1.Users).save(users);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, users) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const ctx = (0, dbContext_1.getDbContext)();
                // If an active branch context exists, only allow updates within that branch.
                if (ctx === null || ctx === void 0 ? void 0 : ctx.branchId) {
                    const existing = yield this.findOne(id);
                    if (!existing) {
                        throw new Error("ไม่พบผู้ใช้");
                    }
                    users.branch_id = ctx.branchId;
                }
                return (0, dbContext_1.getRepository)(Users_1.Users).save(Object.assign(Object.assign({}, users), { id }));
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const ctx = (0, dbContext_1.getDbContext)();
                const usersRepo = (0, dbContext_1.getRepository)(Users_1.Users);
                if (ctx === null || ctx === void 0 ? void 0 : ctx.branchId) {
                    const result = yield usersRepo.delete({ id, branch_id: ctx.branchId });
                    if (!result.affected) {
                        throw new Error("ไม่พบผู้ใช้");
                    }
                    return;
                }
                yield usersRepo.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.UsersModels = UsersModels;
