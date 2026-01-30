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
exports.SalesOrderItem = void 0;
const typeorm_1 = require("typeorm");
const SalesOrder_1 = require("./SalesOrder");
const OrderEnums_1 = require("./OrderEnums");
const Products_1 = require("./Products");
const SalesOrderDetail_1 = require("./SalesOrderDetail");
let SalesOrderItem = class SalesOrderItem {
};
exports.SalesOrderItem = SalesOrderItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], SalesOrderItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "order_id", type: "uuid", nullable: true }),
    __metadata("design:type", String)
], SalesOrderItem.prototype, "order_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SalesOrder_1.SalesOrder, (order) => order.items),
    (0, typeorm_1.JoinColumn)({ name: "order_id" }),
    __metadata("design:type", SalesOrder_1.SalesOrder)
], SalesOrderItem.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "product_id", type: "uuid", nullable: true }),
    __metadata("design:type", String)
], SalesOrderItem.prototype, "product_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Products_1.Products),
    (0, typeorm_1.JoinColumn)({ name: "product_id" }),
    __metadata("design:type", Products_1.Products)
], SalesOrderItem.prototype, "product", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 1 }),
    __metadata("design:type", Number)
], SalesOrderItem.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], SalesOrderItem.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], SalesOrderItem.prototype, "discount_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], SalesOrderItem.prototype, "total_price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], SalesOrderItem.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: "enum", enum: OrderEnums_1.OrderStatus, default: OrderEnums_1.OrderStatus.Pending }),
    __metadata("design:type", String)
], SalesOrderItem.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => SalesOrderDetail_1.SalesOrderDetail, (detail) => detail.sales_order_item),
    __metadata("design:type", Array)
], SalesOrderItem.prototype, "details", void 0);
exports.SalesOrderItem = SalesOrderItem = __decorate([
    (0, typeorm_1.Entity)("sales_order_item")
], SalesOrderItem);
