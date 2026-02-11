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
exports.FixTopSellingItemsExcludeCancelled1770900000000 = void 0;
class FixTopSellingItemsExcludeCancelled1770900000000 {
    constructor() {
        this.name = "FixTopSellingItemsExcludeCancelled1770900000000";
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`DROP VIEW IF EXISTS "top_selling_items_view"`);
            yield queryRunner.query(`
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
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`DROP VIEW IF EXISTS "top_selling_items_view"`);
            yield queryRunner.query(`
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
        });
    }
}
exports.FixTopSellingItemsExcludeCancelled1770900000000 = FixTopSellingItemsExcludeCancelled1770900000000;
