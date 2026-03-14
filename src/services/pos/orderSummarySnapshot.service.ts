import { EntityManager } from "typeorm";

import { OrderSummarySnapshot } from "../../entity/pos/OrderSummarySnapshot";
import { getDbManager } from "../../database/dbContext";

type SummarySnapshotPayload = {
    id: string;
    order_no: string | null;
    order_type: string;
    status: string;
    create_date: string;
    update_date: string;
    total_amount: number;
    delivery_code?: string | null;
    customer_name?: string | null;
    table_id?: string | null;
    delivery_id?: string | null;
    table?: { table_name?: string | null } | null;
    delivery?: { delivery_name?: string | null; logo?: string | null } | null;
    items_count: number;
};

function mapSnapshot(snapshot: OrderSummarySnapshot | null): SummarySnapshotPayload | null {
    if (!snapshot) return null;

    return {
        id: snapshot.order_id,
        order_no: snapshot.order_no,
        order_type: snapshot.order_type,
        status: snapshot.status,
        create_date: snapshot.create_date instanceof Date ? snapshot.create_date.toISOString() : String(snapshot.create_date),
        update_date: snapshot.update_date instanceof Date ? snapshot.update_date.toISOString() : String(snapshot.update_date),
        total_amount: Number(snapshot.total_amount || 0),
        delivery_code: snapshot.delivery_code ?? null,
        customer_name: snapshot.customer_name ?? null,
        table_id: snapshot.table_id ?? null,
        delivery_id: snapshot.delivery_id ?? null,
        table: snapshot.table_name ? { table_name: snapshot.table_name } : null,
        delivery: snapshot.delivery_name
            ? { delivery_name: snapshot.delivery_name, logo: snapshot.delivery_logo ?? null }
            : null,
        items_count: Number(snapshot.items_count || 0),
    };
}

export class OrderSummarySnapshotService {
    private getManager(manager?: EntityManager): EntityManager {
        return manager ?? getDbManager();
    }

    async syncOrder(orderId: string, manager?: EntityManager): Promise<void> {
        const db = this.getManager(manager);

        await db.query(
            `
                INSERT INTO order_summary_snapshots (
                    order_id,
                    branch_id,
                    created_by_id,
                    order_no,
                    order_type,
                    status,
                    create_date,
                    update_date,
                    total_amount,
                    delivery_code,
                    customer_name,
                    table_id,
                    table_name,
                    delivery_id,
                    delivery_name,
                    delivery_logo,
                    items_count
                )
                SELECT
                    o.id AS order_id,
                    o.branch_id,
                    o.created_by_id,
                    o.order_no,
                    o.order_type,
                    o.status,
                    o.create_date,
                    o.update_date,
                    o.total_amount,
                    o.delivery_code,
                    o.customer_name,
                    o.table_id,
                    t.table_name,
                    o.delivery_id,
                    d.delivery_name,
                    d.logo AS delivery_logo,
                    COALESCE(items.items_count, 0) AS items_count
                FROM sales_orders o
                LEFT JOIN tables t ON t.id = o.table_id
                LEFT JOIN delivery d ON d.id = o.delivery_id
                LEFT JOIN LATERAL (
                    SELECT COALESCE(SUM(i.quantity), 0)::int AS items_count
                    FROM sales_order_item i
                    WHERE i.order_id = o.id
                      AND i.status::text NOT IN ('Cancelled', 'cancelled')
                ) items ON true
                WHERE o.id = $1
                ON CONFLICT (order_id) DO UPDATE SET
                    branch_id = EXCLUDED.branch_id,
                    created_by_id = EXCLUDED.created_by_id,
                    order_no = EXCLUDED.order_no,
                    order_type = EXCLUDED.order_type,
                    status = EXCLUDED.status,
                    create_date = EXCLUDED.create_date,
                    update_date = EXCLUDED.update_date,
                    total_amount = EXCLUDED.total_amount,
                    delivery_code = EXCLUDED.delivery_code,
                    customer_name = EXCLUDED.customer_name,
                    table_id = EXCLUDED.table_id,
                    table_name = EXCLUDED.table_name,
                    delivery_id = EXCLUDED.delivery_id,
                    delivery_name = EXCLUDED.delivery_name,
                    delivery_logo = EXCLUDED.delivery_logo,
                    items_count = EXCLUDED.items_count
            `,
            [orderId]
        );
    }

    async deleteOrder(orderId: string, manager?: EntityManager): Promise<void> {
        await this.getManager(manager).getRepository(OrderSummarySnapshot).delete({ order_id: orderId });
    }

    async syncTableMetadata(tableId: string, manager?: EntityManager): Promise<void> {
        const db = this.getManager(manager);
        await db.query(
            `
                UPDATE order_summary_snapshots s
                SET table_name = t.table_name
                FROM tables t
                WHERE s.table_id = t.id
                  AND t.id = $1
            `,
            [tableId]
        );
    }

    async syncDeliveryMetadata(deliveryId: string, manager?: EntityManager): Promise<void> {
        const db = this.getManager(manager);
        await db.query(
            `
                UPDATE order_summary_snapshots s
                SET delivery_name = d.delivery_name,
                    delivery_logo = d.logo
                FROM delivery d
                WHERE s.delivery_id = d.id
                  AND d.id = $1
            `,
            [deliveryId]
        );
    }

    async findOne(orderId: string, manager?: EntityManager): Promise<OrderSummarySnapshot | null> {
        return this.getManager(manager).getRepository(OrderSummarySnapshot).findOneBy({ order_id: orderId });
    }

    async getPayload(orderId: string, manager?: EntityManager): Promise<SummarySnapshotPayload | null> {
        return mapSnapshot(await this.findOne(orderId, manager));
    }
}
