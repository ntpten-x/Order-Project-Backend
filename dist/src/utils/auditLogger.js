"use strict";
/**
 * Audit Logger
 * Logs all important business actions for compliance and tracking
 * Stores logs in database for persistence
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
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
exports.auditLogger = exports.AuditLog = exports.AuditActionType = void 0;
exports.getUserInfoFromRequest = getUserInfoFromRequest;
const database_1 = require("../database/database");
const typeorm_1 = require("typeorm");
var AuditActionType;
(function (AuditActionType) {
    // Order actions
    AuditActionType["ORDER_CREATE"] = "ORDER_CREATE";
    AuditActionType["ORDER_UPDATE"] = "ORDER_UPDATE";
    AuditActionType["ORDER_DELETE"] = "ORDER_DELETE";
    AuditActionType["ORDER_STATUS_CHANGE"] = "ORDER_STATUS_CHANGE";
    // Payment actions
    AuditActionType["PAYMENT_CREATE"] = "PAYMENT_CREATE";
    AuditActionType["PAYMENT_UPDATE"] = "PAYMENT_UPDATE";
    AuditActionType["PAYMENT_DELETE"] = "PAYMENT_DELETE";
    // Item actions
    AuditActionType["ITEM_ADD"] = "ITEM_ADD";
    AuditActionType["ITEM_UPDATE"] = "ITEM_UPDATE";
    AuditActionType["ITEM_DELETE"] = "ITEM_DELETE";
    // Queue actions
    AuditActionType["QUEUE_ADD"] = "QUEUE_ADD";
    AuditActionType["QUEUE_UPDATE"] = "QUEUE_UPDATE";
    AuditActionType["QUEUE_REMOVE"] = "QUEUE_REMOVE";
    AuditActionType["QUEUE_REORDER"] = "QUEUE_REORDER";
    // Product actions
    AuditActionType["PRODUCT_CREATE"] = "PRODUCT_CREATE";
    AuditActionType["PRODUCT_UPDATE"] = "PRODUCT_UPDATE";
    AuditActionType["PRODUCT_DELETE"] = "PRODUCT_DELETE";
    // User actions
    AuditActionType["USER_CREATE"] = "USER_CREATE";
    AuditActionType["USER_UPDATE"] = "USER_UPDATE";
    AuditActionType["USER_DELETE"] = "USER_DELETE";
    // Stock actions
    AuditActionType["STOCK_RECEIVE"] = "STOCK_RECEIVE";
    AuditActionType["STOCK_TRANSFER"] = "STOCK_TRANSFER";
    AuditActionType["STOCK_ADJUST"] = "STOCK_ADJUST";
    // Other important actions
    AuditActionType["DISCOUNT_APPLY"] = "DISCOUNT_APPLY";
    AuditActionType["PROMOTION_APPLY"] = "PROMOTION_APPLY";
    AuditActionType["SHIFT_OPEN"] = "SHIFT_OPEN";
    AuditActionType["SHIFT_CLOSE"] = "SHIFT_CLOSE";
})(AuditActionType || (exports.AuditActionType = AuditActionType = {}));
let AuditLog = class AuditLog {
};
exports.AuditLog = AuditLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: AuditActionType }),
    __metadata("design:type", String)
], AuditLog.prototype, "action_type", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "username", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], AuditLog.prototype, "ip_address", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "user_agent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "entity_type", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "entity_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "branch_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], AuditLog.prototype, "old_values", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], AuditLog.prototype, "new_values", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "path", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "method", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], AuditLog.prototype, "created_at", void 0);
exports.AuditLog = AuditLog = __decorate([
    (0, typeorm_1.Entity)('audit_logs'),
    (0, typeorm_1.Index)(['user_id', 'created_at']),
    (0, typeorm_1.Index)(['action_type', 'created_at']),
    (0, typeorm_1.Index)(['entity_type', 'entity_id'])
], AuditLog);
class AuditLogger {
    constructor() {
        this.repository = database_1.AppDataSource.getRepository(AuditLog);
    }
    /**
     * Log an audit event
     */
    log(params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const auditLog = this.repository.create(Object.assign(Object.assign({}, params), { created_at: new Date() }));
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
    return {
        user_id: user === null || user === void 0 ? void 0 : user.id,
        username: user === null || user === void 0 ? void 0 : user.username,
        branch_id: user === null || user === void 0 ? void 0 : user.branch_id,
    };
}
