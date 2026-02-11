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
exports.RolesService = void 0;
const socket_service_1 = require("./socket.service");
const realtimeEvents_1 = require("../utils/realtimeEvents");
const role_1 = require("../utils/role");
class RolesService {
    constructor(rolesModels) {
        this.rolesModels = rolesModels;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    normalizeWellKnownRole(data) {
        const normalized = (0, role_1.normalizeRoleName)(data === null || data === void 0 ? void 0 : data.roles_name);
        if (!normalized)
            return data;
        return Object.assign(Object.assign({}, data), { roles_name: normalized });
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.rolesModels.findAll();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.rolesModels.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                data = this.normalizeWellKnownRole(data);
                // @ts-ignore - model returns {id} essentially
                const savedRole = yield this.rolesModels.create(data);
                const createdRole = yield this.rolesModels.findOne(savedRole.id);
                if (createdRole) {
                    this.socketService.emitToRole('Admin', realtimeEvents_1.RealtimeEvents.roles.create, createdRole);
                    return createdRole;
                }
                return savedRole;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                data = this.normalizeWellKnownRole(data);
                yield this.rolesModels.update(id, data);
                const updatedRole = yield this.rolesModels.findOne(id);
                if (updatedRole) {
                    this.socketService.emitToRole('Admin', realtimeEvents_1.RealtimeEvents.roles.update, updatedRole);
                    return updatedRole;
                }
                throw new Error("ไม่พบข้อมูลบทบาท");
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.rolesModels.delete(id);
                this.socketService.emitToRole('Admin', realtimeEvents_1.RealtimeEvents.roles.delete, { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.RolesService = RolesService;
