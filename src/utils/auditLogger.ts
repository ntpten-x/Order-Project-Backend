/**
 * Audit Logger
 * Logs all important business actions for compliance and tracking.
 * Stores logs in database for persistence.
 */

import { getDbContext, getRepository } from "../database/dbContext";
import { AuditLog } from "../entity/AuditLog";
import { AuditActionType } from "./auditTypes";
import { redactAuditPayload } from "./auditRedaction";

class AuditLogger {
    private get repository() {
        return getRepository(AuditLog);
    }

    /**
     * Log an audit event
     */
    async log(params: {
        action_type: AuditActionType;
        user_id?: string;
        username?: string;
        ip_address: string;
        user_agent?: string;
        entity_type?: string;
        entity_id?: string;
        branch_id?: string;
        old_values?: unknown;
        new_values?: unknown;
        description?: string;
        path?: string;
        method?: string;
    }): Promise<void> {
        try {
            const ctx = getDbContext();
            const branch_id = params.branch_id ?? ctx?.branchId;

            const old_values =
                typeof params.old_values === "undefined" ? undefined : redactAuditPayload(params.old_values);
            const new_values =
                typeof params.new_values === "undefined" ? undefined : redactAuditPayload(params.new_values);

            // Avoid overload/type inference issues with `Repository.create` by building a typed payload.
            const createPayload: Partial<AuditLog> = {
                action_type: params.action_type,
                user_id: params.user_id,
                username: params.username,
                ip_address: params.ip_address,
                user_agent: params.user_agent,
                entity_type: params.entity_type,
                entity_id: params.entity_id,
                branch_id,
                old_values: old_values as any,
                new_values: new_values as any,
                description: params.description,
                path: params.path,
                method: params.method,
                created_at: new Date(),
            };

            const auditLog = this.repository.create(createPayload as any);

            await this.repository.save(auditLog);

            // Also log to console for development
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[AUDIT] ${params.action_type} by ${params.username || params.user_id || 'Unknown'} on ${params.entity_type || 'N/A'}`);
            }
        } catch (error) {
            // Don't fail the main operation if audit logging fails
            console.error('[AUDIT] Failed to log audit event:', error);
        }
    }

    /**
     * Get audit logs with filters
     */
    async getLogs(filters: {
        user_id?: string;
        action_type?: AuditActionType;
        entity_type?: string;
        entity_id?: string;
        branch_id?: string;
        start_date?: Date;
        end_date?: Date;
        limit?: number;
        offset?: number;
    }): Promise<{ logs: AuditLog[]; total: number }> {
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

        const [logs, total] = await queryBuilder.getManyAndCount();
        return { logs, total };
    }
}

// Singleton instance
export const auditLogger = new AuditLogger();
export { AuditActionType };

/**
 * Helper function to extract user info from request
 */
export function getUserInfoFromRequest(req: any): { user_id?: string; username?: string; branch_id?: string } {
    const user = req.user || (req as any).user;
    const ctx = getDbContext();
    return {
        user_id: user?.id,
        username: user?.username,
        // Prefer DB context branch (supports admin branch switching)
        branch_id: ctx?.branchId || user?.branch_id,
    };
}
