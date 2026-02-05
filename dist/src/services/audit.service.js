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
exports.AuditService = void 0;
const AuditLog_1 = require("../entity/AuditLog");
const dbContext_1 = require("../database/dbContext");
class AuditService {
    get repository() {
        return (0, dbContext_1.getRepository)(AuditLog_1.AuditLog);
    }
    getLogs(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = Math.max(filters.page || 1, 1);
            const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
            const qb = this.repository.createQueryBuilder("audit");
            if (filters.user_id) {
                qb.andWhere("audit.user_id = :user_id", { user_id: filters.user_id });
            }
            if (filters.action_type) {
                qb.andWhere("audit.action_type = :action_type", { action_type: filters.action_type });
            }
            if (filters.entity_type) {
                qb.andWhere("audit.entity_type = :entity_type", { entity_type: filters.entity_type });
            }
            if (filters.entity_id) {
                qb.andWhere("audit.entity_id = :entity_id", { entity_id: filters.entity_id });
            }
            if (filters.branch_id) {
                qb.andWhere("audit.branch_id = :branch_id", { branch_id: filters.branch_id });
            }
            if (filters.start_date) {
                qb.andWhere("audit.created_at >= :start_date", { start_date: filters.start_date });
            }
            if (filters.end_date) {
                qb.andWhere("audit.created_at <= :end_date", { end_date: filters.end_date });
            }
            if (filters.search) {
                const search = `%${filters.search}%`;
                qb.andWhere("(audit.username ILIKE :search OR audit.description ILIKE :search OR audit.entity_type ILIKE :search OR audit.action_type ILIKE :search)", { search });
            }
            qb.orderBy("audit.created_at", "DESC");
            qb.skip((page - 1) * limit);
            qb.take(limit);
            const [logs, total] = yield qb.getManyAndCount();
            return { logs, total, page, limit };
        });
    }
    getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.repository.findOne({ where: { id } });
        });
    }
}
exports.AuditService = AuditService;
