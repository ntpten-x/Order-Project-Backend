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
exports.SalesOrderDetail = void 0;
const typeorm_1 = require("typeorm");
const SalesOrderItem_1 = require("./SalesOrderItem");
let SalesOrderDetail = class SalesOrderDetail {
};
exports.SalesOrderDetail = SalesOrderDetail;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], SalesOrderDetail.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "orders_item_id", type: "uuid" }),
    __metadata("design:type", String)
], SalesOrderDetail.prototype, "orders_item_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SalesOrderItem_1.SalesOrderItem, (item) => item.details),
    (0, typeorm_1.JoinColumn)({ name: "orders_item_id" }),
    __metadata("design:type", SalesOrderItem_1.SalesOrderItem)
], SalesOrderDetail.prototype, "sales_order_item", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255, default: "" }),
    __metadata("design:type", String)
], SalesOrderDetail.prototype, "detail_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], SalesOrderDetail.prototype, "extra_price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], SalesOrderDetail.prototype, "create_date", void 0);
exports.SalesOrderDetail = SalesOrderDetail = __decorate([
    (0, typeorm_1.Entity)("sales_order_detail")
], SalesOrderDetail);
