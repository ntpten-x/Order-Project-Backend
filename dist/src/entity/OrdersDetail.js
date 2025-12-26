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
exports.OrdersDetail = void 0;
const typeorm_1 = require("typeorm");
const OrdersItem_1 = require("./OrdersItem");
const Users_1 = require("./Users");
let OrdersDetail = class OrdersDetail {
};
exports.OrdersDetail = OrdersDetail;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], OrdersDetail.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "orders_item_id", type: "uuid", unique: true }),
    __metadata("design:type", String)
], OrdersDetail.prototype, "orders_item_id", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => OrdersItem_1.OrdersItem, (ordersItem) => ordersItem.ordersDetail, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: "orders_item_id" }),
    __metadata("design:type", OrdersItem_1.OrdersItem)
], OrdersDetail.prototype, "ordersItem", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "actual_quantity", type: "int", nullable: true }),
    __metadata("design:type", Number)
], OrdersDetail.prototype, "actual_quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "purchased_by_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], OrdersDetail.prototype, "purchased_by_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Users_1.Users, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "purchased_by_id" }),
    __metadata("design:type", Object)
], OrdersDetail.prototype, "purchased_by", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_purchased", type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], OrdersDetail.prototype, "is_purchased", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], OrdersDetail.prototype, "create_date", void 0);
exports.OrdersDetail = OrdersDetail = __decorate([
    (0, typeorm_1.Entity)()
], OrdersDetail);
