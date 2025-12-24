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
exports.RolesModels = void 0;
const database_1 = require("../database/database");
const Roles_1 = require("../entity/Roles");
class RolesModels {
    constructor() {
        this.rolesRepository = database_1.AppDataSource.getRepository(Roles_1.Roles);
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.rolesRepository.createQueryBuilder("roles").getMany();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.rolesRepository.createQueryBuilder("roles").where("roles.id = :id", { id }).getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.rolesRepository.createQueryBuilder("roles").insert().values(data).returning("id").execute().then((result) => result.raw[0]);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.rolesRepository.createQueryBuilder("roles").update(data).where("roles.id = :id", { id }).returning("id").execute().then((result) => result.raw[0]);
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.rolesRepository.createQueryBuilder("roles").delete().where("roles.id = :id", { id }).execute();
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.RolesModels = RolesModels;
