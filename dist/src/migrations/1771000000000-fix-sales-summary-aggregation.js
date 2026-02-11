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
exports.FixSalesSummaryAggregation1771000000000 = void 0;
class FixSalesSummaryAggregation1771000000000 {
    constructor() {
        this.name = "FixSalesSummaryAggregation1771000000000";
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`DROP VIEW IF EXISTS "sales_summary_view"`);
            yield queryRunner.query(`
            CREATE VIEW "sales_summary_view" AS
            WITH order_daily AS (
                SELECT
                    o.branch_id AS branch_id,
                    DATE(o.create_date) AS date,
                    COUNT(*)::int AS total_orders,
                    COALESCE(SUM(o.total_amount), 0) AS total_sales,
                    COALESCE(SUM(o.discount_amount), 0) AS total_discount
                FROM sales_orders o
                WHERE o.status IN ('Paid', 'Completed')
                GROUP BY o.branch_id, DATE(o.create_date)
            ),
            payment_daily AS (
                SELECT
                    o.branch_id AS branch_id,
                    DATE(o.create_date) AS date,
                    COALESCE(SUM(CASE
                        WHEN pm.payment_method_name ILIKE '%cash%' OR pm.display_name ILIKE '%สด%' THEN p.amount
                        ELSE 0
                    END), 0) AS cash_sales,
                    COALESCE(SUM(CASE
                        WHEN pm.payment_method_name ILIKE '%qr%' OR pm.payment_method_name ILIKE '%prompt%' THEN p.amount
                        ELSE 0
                    END), 0) AS qr_sales,
                    COALESCE(SUM(CASE WHEN o.order_type = 'DineIn' THEN p.amount ELSE 0 END), 0) AS dine_in_sales,
                    COALESCE(SUM(CASE WHEN o.order_type = 'TakeAway' THEN p.amount ELSE 0 END), 0) AS takeaway_sales,
                    COALESCE(SUM(CASE WHEN o.order_type = 'Delivery' THEN p.amount ELSE 0 END), 0) AS delivery_sales
                FROM sales_orders o
                LEFT JOIN payments p ON p.order_id = o.id AND p.status = 'Success'
                LEFT JOIN payment_method pm ON p.payment_method_id = pm.id
                WHERE o.status IN ('Paid', 'Completed')
                GROUP BY o.branch_id, DATE(o.create_date)
            )
            SELECT
                od.branch_id AS branch_id,
                od.date AS date,
                od.total_orders AS total_orders,
                od.total_sales AS total_sales,
                od.total_discount AS total_discount,
                COALESCE(pd.cash_sales, 0) AS cash_sales,
                COALESCE(pd.qr_sales, 0) AS qr_sales,
                COALESCE(pd.dine_in_sales, 0) AS dine_in_sales,
                COALESCE(pd.takeaway_sales, 0) AS takeaway_sales,
                COALESCE(pd.delivery_sales, 0) AS delivery_sales
            FROM order_daily od
            LEFT JOIN payment_daily pd
              ON pd.branch_id = od.branch_id
             AND pd.date = od.date
        `);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`DROP VIEW IF EXISTS "sales_summary_view"`);
            yield queryRunner.query(`
            CREATE VIEW "sales_summary_view" AS
            SELECT
                o.branch_id AS branch_id,
                DATE(o.create_date) AS date,
                COUNT(DISTINCT o.id) AS total_orders,
                SUM(o.total_amount) AS total_sales,
                SUM(o.discount_amount) AS total_discount,
                SUM(CASE
                    WHEN pm.payment_method_name ILIKE '%cash%' OR pm.display_name ILIKE '%สด%' THEN p.amount
                    ELSE 0
                END) AS cash_sales,
                SUM(CASE
                    WHEN pm.payment_method_name ILIKE '%qr%' OR pm.payment_method_name ILIKE '%prompt%' THEN p.amount
                    ELSE 0
                END) AS qr_sales,
                SUM(CASE WHEN o.order_type = 'DineIn' THEN p.amount ELSE 0 END) AS dine_in_sales,
                SUM(CASE WHEN o.order_type = 'TakeAway' THEN p.amount ELSE 0 END) AS takeaway_sales,
                SUM(CASE WHEN o.order_type = 'Delivery' THEN p.amount ELSE 0 END) AS delivery_sales
            FROM sales_orders o
            LEFT JOIN payments p ON p.order_id = o.id AND p.status = 'Success'
            LEFT JOIN payment_method pm ON p.payment_method_id = pm.id
            WHERE o.status IN ('Paid', 'Completed')
            GROUP BY o.branch_id, DATE(o.create_date)
        `);
        });
    }
}
exports.FixSalesSummaryAggregation1771000000000 = FixSalesSummaryAggregation1771000000000;
