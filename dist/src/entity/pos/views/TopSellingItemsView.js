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
exports.TopSellingItemsView = void 0;
const typeorm_1 = require("typeorm");
const SalesOrderItem_1 = require("../SalesOrderItem");
const SalesOrder_1 = require("../SalesOrder");
const Products_1 = require("../Products");
let TopSellingItemsView = class TopSellingItemsView {
};
exports.TopSellingItemsView = TopSellingItemsView;
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", String)
], TopSellingItemsView.prototype, "product_id", void 0);
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", String)
], TopSellingItemsView.prototype, "product_name", void 0);
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", String)
], TopSellingItemsView.prototype, "img_url", void 0);
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", String)
], TopSellingItemsView.prototype, "category_id", void 0);
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", Number)
], TopSellingItemsView.prototype, "total_quantity", void 0);
__decorate([
    (0, typeorm_1.ViewColumn)(),
    __metadata("design:type", Number)
], TopSellingItemsView.prototype, "total_revenue", void 0);
exports.TopSellingItemsView = TopSellingItemsView = __decorate([
    (0, typeorm_1.ViewEntity)({
        expression: (dataSource) => dataSource
            .createQueryBuilder()
            .select("oi.product_id", "product_id")
            .addSelect("p.display_name", "product_name")
            .addSelect("p.img_url", "img_url")
            .addSelect("p.category_id", "category_id")
            .addSelect("SUM(oi.quantity)", "total_quantity")
            .addSelect("SUM(oi.total_price)", "total_revenue")
            .from(SalesOrderItem_1.SalesOrderItem, "oi")
            .innerJoin(SalesOrder_1.SalesOrder, "o", "oi.order_id = o.id")
            .leftJoin(Products_1.Products, "p", "oi.product_id = p.id")
            .where("o.status IN ('Paid', 'Completed')")
            .groupBy("oi.product_id")
            .addGroupBy("p.display_name")
            .addGroupBy("p.img_url")
            .addGroupBy("p.category_id"),
        synchronize: true
    })
], TopSellingItemsView);
