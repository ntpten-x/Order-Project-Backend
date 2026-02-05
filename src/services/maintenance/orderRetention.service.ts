import { getDbManager, runInTransaction, runWithDbContext } from "../../database/dbContext";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_ORDER_RETENTION_DAYS = 30;
export const DEFAULT_CLOSED_ORDER_STATUSES = [
    "Paid",
    "Completed",
    "Cancelled",
    // Legacy enum values (kept in OrderStatus for migration)
    "completed",
    "cancelled",
];
export const DEFAULT_ORDER_QUEUE_RETENTION_DAYS = 7;
export const DEFAULT_QUEUE_CLOSED_STATUSES = ["Completed", "Cancelled", "completed", "cancelled"];

export type OrderRetentionCleanupOptions = {
    retentionDays?: number;
    statuses?: string[];
    batchSize?: number;
    maxBatches?: number;
    dryRun?: boolean;
};

export type OrderRetentionCleanupResult = {
    cutoffDate: Date;
    dryRun: boolean;
    batchesProcessed: number;
    candidateOrders: number;
    deleted: {
        orders: number;
        orderQueue: number;
        payments: number;
        items: number;
        details: number;
    };
};

export type QueueCleanupResult = {
    cutoffDate: Date;
    dryRun: boolean;
    deleted: number;
    candidateCount: number;
};

function toInt(value: unknown): number | undefined {
    if (value === undefined || value === null) return undefined;
    const n = typeof value === "number" ? value : Number(String(value));
    if (!Number.isFinite(n)) return undefined;
    return Math.trunc(n);
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
    const n = toInt(value);
    if (n === undefined) return fallback;
    return Math.min(max, Math.max(min, n));
}

function normalizeStatuses(statuses: string[] | undefined): string[] {
    const source = statuses && statuses.length > 0 ? statuses : DEFAULT_CLOSED_ORDER_STATUSES;
    const cleaned = source
        .map((s) => String(s || "").trim())
        .filter(Boolean);

    return Array.from(new Set(cleaned));
}

async function countCandidates(params: { cutoffDate: Date; statuses: string[] }): Promise<number> {
    const db = getDbManager();
    const rows = await db.query(
        `
            SELECT COUNT(*)::int AS count
            FROM sales_orders o
            WHERE o.status::text = ANY($1::text[])
              AND o.create_date < $2
        `,
        [params.statuses, params.cutoffDate]
    );
    return Number(rows?.[0]?.count ?? 0);
}

async function fetchCandidateIds(params: {
    cutoffDate: Date;
    statuses: string[];
    limit: number;
}): Promise<string[]> {
    const db = getDbManager();
    const rows = await db.query(
        `
            SELECT o.id
            FROM sales_orders o
            WHERE o.status::text = ANY($1::text[])
              AND o.create_date < $2
            ORDER BY o.create_date ASC
            LIMIT $3
        `,
        [params.statuses, params.cutoffDate, params.limit]
    );

    return (rows ?? []).map((r: any) => String(r.id));
}

async function deleteByOrderIds(orderIds: string[]): Promise<{
    orders: number;
    orderQueue: number;
    payments: number;
    items: number;
    details: number;
}> {
    if (orderIds.length === 0) {
        return { orders: 0, orderQueue: 0, payments: 0, items: 0, details: 0 };
    }

    return await runInTransaction(async (manager) => {
        const idsParam = [orderIds];

        const orderQueueRows = await manager.query(
            `
                WITH deleted AS (
                    DELETE FROM order_queue
                    WHERE order_id = ANY($1::uuid[])
                    RETURNING 1
                )
                SELECT COUNT(*)::int AS count FROM deleted
            `,
            idsParam
        );
        const orderQueue = Number(orderQueueRows?.[0]?.count ?? 0);

        const paymentsRows = await manager.query(
            `
                WITH deleted AS (
                    DELETE FROM payments
                    WHERE order_id = ANY($1::uuid[])
                    RETURNING 1
                )
                SELECT COUNT(*)::int AS count FROM deleted
            `,
            idsParam
        );
        const payments = Number(paymentsRows?.[0]?.count ?? 0);

        const detailsRows = await manager.query(
            `
                WITH deleted AS (
                    DELETE FROM sales_order_detail d
                    USING sales_order_item i
                    WHERE d.orders_item_id = i.id
                      AND i.order_id = ANY($1::uuid[])
                    RETURNING 1
                )
                SELECT COUNT(*)::int AS count FROM deleted
            `,
            idsParam
        );
        const details = Number(detailsRows?.[0]?.count ?? 0);

        const itemsRows = await manager.query(
            `
                WITH deleted AS (
                    DELETE FROM sales_order_item
                    WHERE order_id = ANY($1::uuid[])
                    RETURNING 1
                )
                SELECT COUNT(*)::int AS count FROM deleted
            `,
            idsParam
        );
        const items = Number(itemsRows?.[0]?.count ?? 0);

        const ordersRows = await manager.query(
            `
                WITH deleted AS (
                    DELETE FROM sales_orders
                    WHERE id = ANY($1::uuid[])
                    RETURNING 1
                )
                SELECT COUNT(*)::int AS count FROM deleted
            `,
            idsParam
        );
        const orders = Number(ordersRows?.[0]?.count ?? 0);

        return { orders, orderQueue, payments, items, details };
    });
}

export async function cleanupClosedOrdersOlderThan(
    options: OrderRetentionCleanupOptions = {}
): Promise<OrderRetentionCleanupResult> {
    const retentionDays = clampInt(options.retentionDays, DEFAULT_ORDER_RETENTION_DAYS, 1, 3650);
    const batchSize = clampInt(options.batchSize, 500, 1, 5000);
    const maxBatches = clampInt(options.maxBatches, 50, 1, 10_000);
    const dryRun = Boolean(options.dryRun);
    const statuses = normalizeStatuses(options.statuses);

    const cutoffDate = new Date(Date.now() - retentionDays * MS_PER_DAY);

    return await runWithDbContext({ isAdmin: true }, async () => {
        const candidateOrders = await countCandidates({ cutoffDate, statuses });

        if (dryRun || candidateOrders === 0) {
            return {
                cutoffDate,
                dryRun,
                batchesProcessed: 0,
                candidateOrders,
                deleted: { orders: 0, orderQueue: 0, payments: 0, items: 0, details: 0 },
            };
        }

        let batchesProcessed = 0;
        const deleted = { orders: 0, orderQueue: 0, payments: 0, items: 0, details: 0 };

        for (let i = 0; i < maxBatches; i++) {
            const ids = await fetchCandidateIds({ cutoffDate, statuses, limit: batchSize });
            if (ids.length === 0) break;

            const batchDeleted = await deleteByOrderIds(ids);
            deleted.orders += batchDeleted.orders;
            deleted.orderQueue += batchDeleted.orderQueue;
            deleted.payments += batchDeleted.payments;
            deleted.items += batchDeleted.items;
            deleted.details += batchDeleted.details;

            batchesProcessed += 1;
        }

        return {
            cutoffDate,
            dryRun,
            batchesProcessed,
            candidateOrders,
            deleted,
        };
    });
}

export async function cleanupOrderQueueOlderThan(options: {
    retentionDays?: number;
    statuses?: string[];
    dryRun?: boolean;
} = {}): Promise<QueueCleanupResult> {
    const retentionDays = clampInt(options.retentionDays, DEFAULT_ORDER_QUEUE_RETENTION_DAYS, 1, 3650);
    const statuses = normalizeStatuses(options.statuses ?? DEFAULT_QUEUE_CLOSED_STATUSES);
    const cutoffDate = new Date(Date.now() - retentionDays * MS_PER_DAY);
    const dryRun = Boolean(options.dryRun);

    const db = getDbManager();
    const candidateRows = await db.query(
        `SELECT id FROM order_queue WHERE status::text = ANY($1::text[]) AND created_at < $2`,
        [statuses, cutoffDate]
    );
    const candidateIds: string[] = (candidateRows ?? []).map((r: any) => String(r.id));

    if (dryRun || candidateIds.length === 0) {
        return { cutoffDate, dryRun, deleted: 0, candidateCount: candidateIds.length };
    }

    const result = await db.query(
        `DELETE FROM order_queue WHERE id = ANY($1::uuid[]) RETURNING 1`,
        [candidateIds]
    );
    const deleted = Number(result?.length ?? 0);
    return { cutoffDate, dryRun: false, deleted, candidateCount: candidateIds.length };
}
