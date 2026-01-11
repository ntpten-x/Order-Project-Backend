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
const database_1 = require("../database/database");
const Users_1 = require("../entity/Users");
class UsersModels {
    constructor() {
        this.usersRepository = database_1.AppDataSource.getRepository(Users_1.Users);
    }
    findAll(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = this.usersRepository.createQueryBuilder("users")
                    .leftJoinAndSelect("users.roles", "roles")
                    .orderBy("users.is_active", "DESC")
                    .addOrderBy("users.create_date", "ASC");
                if (filters === null || filters === void 0 ? void 0 : filters.role) {
                    query.where("roles.roles_name = :role", { role: filters.role });
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
                return this.usersRepository.createQueryBuilder("users")
                    .leftJoinAndSelect("users.roles", "roles")
                    .where("users.id = :id", { id })
                    .getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByUsername(username) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.usersRepository.createQueryBuilder("users")
                    .leftJoinAndSelect("users.roles", "roles")
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
                return this.usersRepository.save(users);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, users) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.usersRepository.save(Object.assign(Object.assign({}, users), { id }));
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.usersRepository.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.UsersModels = UsersModels;
