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
exports.OrdersItem = void 0;
const typeorm_1 = require("typeorm");
const Orders_1 = require("./Orders");
const Products_1 = require("./Products");
const OrdersDetail_1 = require("./OrdersDetail");
let OrdersItem = class OrdersItem {
};
exports.OrdersItem = OrdersItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], OrdersItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "order_id", type: "uuid" }),
    __metadata("design:type", String)
], OrdersItem.prototype, "order_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Orders_1.Orders, (order) => order.items),
    (0, typeorm_1.JoinColumn)({ name: "order_id" }),
    __metadata("design:type", Orders_1.Orders)
], OrdersItem.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "product_id", type: "uuid" }),
    __metadata("design:type", String)
], OrdersItem.prototype, "product_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Products_1.Products),
    (0, typeorm_1.JoinColumn)({ name: "product_id" }),
    __metadata("design:type", Products_1.Products)
], OrdersItem.prototype, "product", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 1 }),
    __metadata("design:type", Number)
], OrdersItem.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], OrdersItem.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], OrdersItem.prototype, "discount_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], OrdersItem.prototype, "total_price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], OrdersItem.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => OrdersDetail_1.OrdersDetail, (detail) => detail.orders_item),
    __metadata("design:type", Array)
], OrdersItem.prototype, "details", void 0);
exports.OrdersItem = OrdersItem = __decorate([
    (0, typeorm_1.Entity)()
], OrdersItem);
