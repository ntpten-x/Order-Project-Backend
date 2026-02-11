"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesSummaryView = void 0;
const typeorm_1 = require("typeorm");
let SalesSummaryView = class SalesSummaryView {
};
exports.SalesSummaryView = SalesSummaryView;
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", String)
], SalesSummaryView.prototype, "branch_id", void 0);
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", String)
], SalesSummaryView.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", Number)
], SalesSummaryView.prototype, "total_orders", void 0);
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", Number)
], SalesSummaryView.prototype, "total_sales", void 0);
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", Number)
], SalesSummaryView.prototype, "total_discount", void 0);
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", Number)
], SalesSummaryView.prototype, "cash_sales", void 0);
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", Number)
], SalesSummaryView.prototype, "qr_sales", void 0);
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", Number)
], SalesSummaryView.prototype, "dine_in_sales", void 0);
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", Number)
], SalesSummaryView.prototype, "takeaway_sales", void 0);
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", Number)
], SalesSummaryView.prototype, "delivery_sales", void 0);
exports.SalesSummaryView = SalesSummaryView = __decorate([
    (0, typeorm_1.ViewEntity)({
        expression: `
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
    `,
        synchronize: true
    })
], SalesSummaryView);
