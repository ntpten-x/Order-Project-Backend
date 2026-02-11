import { MigrationInterface, QueryRunner } from "typeorm";

export class FixTopSellingItemsExcludeCancelled1770900000000 implements MigrationInterface {
    name = "FixTopSellingItemsExcludeCancelled1770900000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS "top_selling_items_view"`);
        await queryRunner.query(`
            CREATE VIEW "top_selling_items_view" AS
            SELECT
                o.branch_id AS branch_id,
                oi.product_id AS product_id,
                p.display_name AS product_name,
                p.img_url AS img_url,
                p.category_id AS category_id,
                SUM(oi.quantity) AS total_quantity,
                SUM(oi.total_price) AS total_revenue
            FROM sales_order_item oi
            INNER JOIN sales_orders o ON oi.order_id = o.id
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE o.status IN ('Paid', 'Completed')
              AND oi.status::text NOT IN ('Cancelled', 'cancelled')
            GROUP BY o.branch_id, oi.product_id, p.display_name, p.img_url, p.category_id
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS "top_selling_items_view"`);
        await queryRunner.query(`
            CREATE VIEW "top_selling_items_view" AS
            SELECT
                o.branch_id AS branch_id,
                oi.product_id AS product_id,
                p.display_name AS product_name,
                p.img_url AS img_url,
                p.category_id AS category_id,
                SUM(oi.quantity) AS total_quantity,
                SUM(oi.total_price) AS total_revenue
            FROM sales_order_item oi
            INNER JOIN sales_orders o ON oi.order_id = o.id
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE o.status IN ('Paid', 'Completed')
            GROUP BY o.branch_id, oi.product_id, p.display_name, p.img_url, p.category_id
        `);
    }
}
