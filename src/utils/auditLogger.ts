/**
 * Audit Logger
 * Logs all important business actions for compliance and tracking
 * Stores logs in database for persistence
 */

import { AppDataSource } from "../database/database";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm";

export enum AuditActionType {
    // Order actions
    ORDER_CREATE = 'ORDER_CREATE',
    ORDER_UPDATE = 'ORDER_UPDATE',
    ORDER_DELETE = 'ORDER_DELETE',
    ORDER_STATUS_CHANGE = 'ORDER_STATUS_CHANGE',
    
    // Payment actions
    PAYMENT_CREATE = 'PAYMENT_CREATE',
    PAYMENT_UPDATE = 'PAYMENT_UPDATE',
    PAYMENT_DELETE = 'PAYMENT_DELETE',
    
    // Item actions
    ITEM_ADD = 'ITEM_ADD',
    ITEM_UPDATE = 'ITEM_UPDATE',
    ITEM_DELETE = 'ITEM_DELETE',
    
    // Queue actions
    QUEUE_ADD = 'QUEUE_ADD',
    QUEUE_UPDATE = 'QUEUE_UPDATE',
    QUEUE_REMOVE = 'QUEUE_REMOVE',
    QUEUE_REORDER = 'QUEUE_REORDER',
    
    // Product actions
    PRODUCT_CREATE = 'PRODUCT_CREATE',
    PRODUCT_UPDATE = 'PRODUCT_UPDATE',
    PRODUCT_DELETE = 'PRODUCT_DELETE',
    
    // User actions
    USER_CREATE = 'USER_CREATE',
    USER_UPDATE = 'USER_UPDATE',
    USER_DELETE = 'USER_DELETE',
    
    // Stock actions
    STOCK_RECEIVE = 'STOCK_RECEIVE',
    STOCK_TRANSFER = 'STOCK_TRANSFER',
    STOCK_ADJUST = 'STOCK_ADJUST',
    
    // Other important actions
    DISCOUNT_APPLY = 'DISCOUNT_APPLY',
    PROMOTION_APPLY = 'PROMOTION_APPLY',
    SHIFT_OPEN = 'SHIFT_OPEN',
    SHIFT_CLOSE = 'SHIFT_CLOSE',
}

@Entity('audit_logs')
@Index(['user_id', 'created_at'])
@Index(['action_type', 'created_at'])
@Index(['entity_type', 'entity_id'])
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'enum', enum: AuditActionType })
    action_type!: AuditActionType;

    @Index()
    @Column({ type: 'uuid', nullable: true })
    user_id?: string;

    @Column({ type: 'varchar', length: 200, nullable: true })
    username?: string;

    @Column({ type: 'varchar', length: 50 })
    ip_address!: string;

    @Column({ type: 'text', nullable: true })
    user_agent?: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    entity_type?: string; // e.g., 'SalesOrder', 'Payments', 'Products'

    @Index()
    @Column({ type: 'uuid', nullable: true })
    entity_id?: string; // ID of the affected entity

    @Column({ type: 'uuid', nullable: true })
    branch_id?: string;

    @Column({ type: 'jsonb', nullable: true })
    old_values?: Record<string, any>; // Previous state

    @Column({ type: 'jsonb', nullable: true })
    new_values?: Record<string, any>; // New state

    @Column({ type: 'text', nullable: true })
    description?: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    path?: string; // API path

    @Column({ type: 'varchar', length: 10, nullable: true })
    method?: string; // HTTP method

    @CreateDateColumn({ type: 'timestamptz' })
    created_at!: Date;
}

class AuditLogger {
    private repository = AppDataSource.getRepository(AuditLog);

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
        old_values?: Record<string, any>;
        new_values?: Record<string, any>;
        description?: string;
        path?: string;
        method?: string;
    }): Promise<void> {
        try {
            const auditLog = this.repository.create({
                ...params,
                created_at: new Date(),
            });

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

/**
 * Helper function to extract user info from request
 */
export function getUserInfoFromRequest(req: any): { user_id?: string; username?: string; branch_id?: string } {
    const user = req.user || (req as any).user;
    return {
        user_id: user?.id,
        username: user?.username,
        branch_id: user?.branch_id,
    };
}
