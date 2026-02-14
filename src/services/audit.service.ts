import { AuditLog } from "../entity/AuditLog";
import { getRepository } from "../database/dbContext";
import { AuditActionType } from "../utils/auditTypes";
import { CreatedSort, createdSortToOrder } from "../utils/sortCreated";

export type AuditLogFilters = {
    page?: number;
    limit?: number;
    action_type?: AuditActionType;
    entity_type?: string;
    entity_id?: string;
    user_id?: string;
    branch_id?: string;
    start_date?: Date;
    end_date?: Date;
    search?: string;
    sort_created?: CreatedSort;
};

export class AuditService {
    private get repository() {
        return getRepository(AuditLog);
    }

    async getLogs(filters: AuditLogFilters) {
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
            qb.andWhere(
                "(audit.username ILIKE :search OR audit.description ILIKE :search OR audit.entity_type ILIKE :search OR audit.action_type ILIKE :search)",
                { search }
            );
        }

        qb.orderBy("audit.created_at", createdSortToOrder(filters.sort_created ?? "old"));
        qb.skip((page - 1) * limit);
        qb.take(limit);

        const [logs, total] = await qb.getManyAndCount();
        return { logs, total, page, limit };
    }

    async getById(id: string) {
        return this.repository.findOne({ where: { id } });
    }
}
