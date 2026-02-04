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
const SalesOrder_1 = require("../SalesOrder");
const Payments_1 = require("../Payments");
const PaymentMethod_1 = require("../PaymentMethod");
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
        expression: (dataSource) => dataSource
            .createQueryBuilder()
            .select("o.branch_id", "branch_id")
            .addSelect("DATE(o.create_date)", "date")
            .addSelect("COUNT(DISTINCT o.id)", "total_orders")
            .addSelect("SUM(o.total_amount)", "total_sales")
            .addSelect("SUM(o.discount_amount)", "total_discount")
            .addSelect(`SUM(CASE 
                WHEN pm.payment_method_name ILIKE '%cash%' OR pm.display_name ILIKE '%สด%' THEN p.amount 
                ELSE 0 END)`, "cash_sales")
            .addSelect(`SUM(CASE 
                WHEN pm.payment_method_name ILIKE '%qr%' OR pm.payment_method_name ILIKE '%prompt%' THEN p.amount 
                ELSE 0 END)`, "qr_sales")
            .addSelect(`SUM(CASE WHEN o.order_type = 'DineIn' THEN p.amount ELSE 0 END)`, "dine_in_sales")
            .addSelect(`SUM(CASE WHEN o.order_type = 'TakeAway' THEN p.amount ELSE 0 END)`, "takeaway_sales")
            .addSelect(`SUM(CASE WHEN o.order_type = 'Delivery' THEN p.amount ELSE 0 END)`, "delivery_sales")
            .from(SalesOrder_1.SalesOrder, "o")
            .leftJoin(Payments_1.Payments, "p", "p.order_id = o.id AND p.status = 'Success'")
            .leftJoin(PaymentMethod_1.PaymentMethod, "pm", "p.payment_method_id = pm.id")
            .where("o.status IN ('Paid', 'Completed')")
            .groupBy("o.branch_id")
            .addGroupBy("DATE(o.create_date)"),
        synchronize: true
    })
], SalesSummaryView);
