"use strict";
/**
 * Audit Logger
 * Logs all important business actions for compliance and tracking.
 * Stores logs in database for persistence.
 */
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
exports.AuditActionType = exports.auditLogger = void 0;
exports.getUserInfoFromRequest = getUserInfoFromRequest;
const dbContext_1 = require("../database/dbContext");
const AuditLog_1 = require("../entity/AuditLog");
const auditTypes_1 = require("./auditTypes");
Object.defineProperty(exports, "AuditActionType", { enumerable: true, get: function () { return auditTypes_1.AuditActionType; } });
class AuditLogger {
    get repository() {
        return (0, dbContext_1.getRepository)(AuditLog_1.AuditLog);
    }
    /**
     * Log an audit event
     */
    log(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const ctx = (0, dbContext_1.getDbContext)();
                const branch_id = (_a = params.branch_id) !== null && _a !== void 0 ? _a : ctx === null || ctx === void 0 ? void 0 : ctx.branchId;
                const auditLog = this.repository.create(Object.assign(Object.assign({}, params), { branch_id, created_at: new Date() }));
                yield this.repository.save(auditLog);
                // Also log to console for development
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`[AUDIT] ${params.action_type} by ${params.username || params.user_id || 'Unknown'} on ${params.entity_type || 'N/A'}`);
                }
            }
            catch (error) {
                // Don't fail the main operation if audit logging fails
                console.error('[AUDIT] Failed to log audit event:', error);
            }
        });
    }
    /**
     * Get audit logs with filters
     */
    getLogs(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryBuilder = this.repository.createQueryBuilder('audit');
            if (filters.user_id) {
                queryBuilder.andWhere('audit.user_id = :user_id', { user_id: filters.user_id });
            }
            if (filters.action_type) {
                queryBuilder.andWhere('audit.action_type = :action_type', { action_type: filters.action_type });
            }
            if (filters.entity_type) {
                queryBuilder.andWhere('audit.entity_type = :entity_type', { entity_type: filters.entity_type });
            }
            if (filters.entity_id) {
                queryBuilder.andWhere('audit.entity_id = :entity_id', { entity_id: filters.entity_id });
            }
            if (filters.branch_id) {
                queryBuilder.andWhere('audit.branch_id = :branch_id', { branch_id: filters.branch_id });
            }
            if (filters.start_date) {
                queryBuilder.andWhere('audit.created_at >= :start_date', { start_date: filters.start_date });
            }
            if (filters.end_date) {
                queryBuilder.andWhere('audit.created_at <= :end_date', { end_date: filters.end_date });
            }
            queryBuilder.orderBy('audit.created_at', 'DESC');
            if (filters.limit) {
                queryBuilder.limit(filters.limit);
            }
            if (filters.offset) {
                queryBuilder.offset(filters.offset);
            }
            const [logs, total] = yield queryBuilder.getManyAndCount();
            return { logs, total };
        });
    }
}
// Singleton instance
exports.auditLogger = new AuditLogger();
/**
 * Helper function to extract user info from request
 */
function getUserInfoFromRequest(req) {
    const user = req.user || req.user;
    const ctx = (0, dbContext_1.getDbContext)();
    return {
        user_id: user === null || user === void 0 ? void 0 : user.id,
        username: user === null || user === void 0 ? void 0 : user.username,
        // Prefer DB context branch (supports admin branch switching)
        branch_id: (ctx === null || ctx === void 0 ? void 0 : ctx.branchId) || (user === null || user === void 0 ? void 0 : user.branch_id),
    };
}
