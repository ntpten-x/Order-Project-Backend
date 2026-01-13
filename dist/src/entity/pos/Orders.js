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
exports.Orders = exports.OrderStatus = exports.OrderType = void 0;
const typeorm_1 = require("typeorm");
const Tables_1 = require("./Tables");
const Delivery_1 = require("./Delivery");
const OrdersItem_1 = require("./OrdersItem");
const Payment_1 = require("./Payment");
const Discounts_1 = require("./Discounts");
const Users_1 = require("../Users");
var OrderType;
(function (OrderType) {
    OrderType["DineIn"] = "DineIn";
    OrderType["TakeAway"] = "TakeAway";
    OrderType["Delivery"] = "Delivery"; // เดลิเวอรี่
})(OrderType || (exports.OrderType = OrderType = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["Pending"] = "Pending";
    OrderStatus["Cooking"] = "Cooking";
    OrderStatus["Served"] = "Served";
    OrderStatus["Paid"] = "Paid";
    OrderStatus["Cancelled"] = "Cancelled"; // ยกเลิกออเดอร์
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
let Orders = class Orders {
};
exports.Orders = Orders;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Orders.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", unique: true }),
    __metadata("design:type", String)
], Orders.prototype, "order_no", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: OrderType }),
    __metadata("design:type", String)
], Orders.prototype, "order_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "table_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], Orders.prototype, "table_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Tables_1.Tables),
    (0, typeorm_1.JoinColumn)({ name: "table_id" }),
    __metadata("design:type", Object)
], Orders.prototype, "table", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "delivery_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], Orders.prototype, "delivery_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Delivery_1.Delivery),
    (0, typeorm_1.JoinColumn)({ name: "delivery_id" }),
    __metadata("design:type", Object)
], Orders.prototype, "delivery", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], Orders.prototype, "delivery_code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Orders.prototype, "sub_total", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "discount_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], Orders.prototype, "discount_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Discounts_1.Discounts),
    (0, typeorm_1.JoinColumn)({ name: "discount_id" }),
    __metadata("design:type", Object)
], Orders.prototype, "discount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Orders.prototype, "discount_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Orders.prototype, "vat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Orders.prototype, "total_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Orders.prototype, "received_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Orders.prototype, "change_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: OrderStatus, default: OrderStatus.Pending }),
    __metadata("design:type", String)
], Orders.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "created_by_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], Orders.prototype, "created_by_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Users_1.Users),
    (0, typeorm_1.JoinColumn)({ name: "created_by_id" }),
    __metadata("design:type", Object)
], Orders.prototype, "created_by", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], Orders.prototype, "create_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], Orders.prototype, "update_date", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => OrdersItem_1.OrdersItem, (item) => item.order),
    __metadata("design:type", Array)
], Orders.prototype, "items", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Payment_1.Payments, (payment) => payment.order),
    __metadata("design:type", Array)
], Orders.prototype, "payments", void 0);
exports.Orders = Orders = __decorate([
    (0, typeorm_1.Entity)()
], Orders);
