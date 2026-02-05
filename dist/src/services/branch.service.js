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
exports.BranchService = void 0;
const Branch_1 = require("../entity/Branch");
const AppError_1 = require("../utils/AppError");
const socket_service_1 = require("./socket.service");
const realtimeEvents_1 = require("../utils/realtimeEvents");
const dbContext_1 = require("../database/dbContext");
class BranchService {
    constructor() {
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    get branchRepo() {
        return (0, dbContext_1.getRepository)(Branch_1.Branch);
    }
    findAll() {
        return __awaiter(this, arguments, void 0, function* (isActive = true) {
            return this.branchRepo.find({
                where: { is_active: isActive },
                order: { create_date: "ASC" }
            });
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.branchRepo.findOneBy({ id });
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const branch = this.branchRepo.create(data);
            const created = yield this.branchRepo.save(branch);
            this.socketService.emitToRole("Admin", realtimeEvents_1.RealtimeEvents.branches.create, created);
            return created;
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const branch = yield this.findOne(id);
            if (!branch) {
                throw new AppError_1.AppError("Branch not found", 404);
            }
            this.branchRepo.merge(branch, data);
            const updated = yield this.branchRepo.save(branch);
            this.socketService.emitToRole("Admin", realtimeEvents_1.RealtimeEvents.branches.update, updated);
            return updated;
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const branch = yield this.findOne(id);
            if (!branch) {
                throw new AppError_1.AppError("Branch not found", 404);
            }
            // Soft delete
            branch.is_active = false;
            yield this.branchRepo.save(branch);
            this.socketService.emitToRole("Admin", realtimeEvents_1.RealtimeEvents.branches.delete, { id });
        });
    }
}
exports.BranchService = BranchService;
