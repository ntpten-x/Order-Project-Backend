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
exports.SalesOrder = void 0;
const typeorm_1 = require("typeorm");
const Tables_1 = require("./Tables");
const Delivery_1 = require("./Delivery");
const SalesOrderItem_1 = require("./SalesOrderItem");
const Payments_1 = require("./Payments");
const Discounts_1 = require("./Discounts");
const Users_1 = require("../Users");
const OrderEnums_1 = require("./OrderEnums");
const Branch_1 = require("../Branch");
let SalesOrder = class SalesOrder {
};
exports.SalesOrder = SalesOrder;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], SalesOrder.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", unique: true, nullable: true }),
    __metadata("design:type", String)
], SalesOrder.prototype, "order_no", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "branch_id", type: "uuid", nullable: true }),
    __metadata("design:type", String)
], SalesOrder.prototype, "branch_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Branch_1.Branch),
    (0, typeorm_1.JoinColumn)({ name: "branch_id" }),
    __metadata("design:type", Branch_1.Branch)
], SalesOrder.prototype, "branch", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: OrderEnums_1.OrderType, nullable: true }),
    __metadata("design:type", String)
], SalesOrder.prototype, "order_type", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "table_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], SalesOrder.prototype, "table_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Tables_1.Tables),
    (0, typeorm_1.JoinColumn)({ name: "table_id" }),
    __metadata("design:type", Object)
], SalesOrder.prototype, "table", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "delivery_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], SalesOrder.prototype, "delivery_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Delivery_1.Delivery),
    (0, typeorm_1.JoinColumn)({ name: "delivery_id" }),
    __metadata("design:type", Object)
], SalesOrder.prototype, "delivery", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], SalesOrder.prototype, "delivery_code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], SalesOrder.prototype, "sub_total", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "discount_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], SalesOrder.prototype, "discount_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Discounts_1.Discounts),
    (0, typeorm_1.JoinColumn)({ name: "discount_id" }),
    __metadata("design:type", Object)
], SalesOrder.prototype, "discount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], SalesOrder.prototype, "discount_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], SalesOrder.prototype, "vat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], SalesOrder.prototype, "total_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], SalesOrder.prototype, "received_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], SalesOrder.prototype, "change_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: OrderEnums_1.OrderStatus, default: OrderEnums_1.OrderStatus.Pending }),
    __metadata("design:type", String)
], SalesOrder.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "created_by_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], SalesOrder.prototype, "created_by_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Users_1.Users),
    (0, typeorm_1.JoinColumn)({ name: "created_by_id" }),
    __metadata("design:type", Object)
], SalesOrder.prototype, "created_by", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], SalesOrder.prototype, "create_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], SalesOrder.prototype, "update_date", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => SalesOrderItem_1.SalesOrderItem, (item) => item.order),
    __metadata("design:type", Array)
], SalesOrder.prototype, "items", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Payments_1.Payments, (payment) => payment.order),
    __metadata("design:type", Array)
], SalesOrder.prototype, "payments", void 0);
exports.SalesOrder = SalesOrder = __decorate([
    (0, typeorm_1.Entity)("sales_orders"),
    (0, typeorm_1.Index)(["create_date"]),
    (0, typeorm_1.Index)(["status"]),
    (0, typeorm_1.Index)(["order_type"]),
    (0, typeorm_1.Index)(["delivery_id"]),
    (0, typeorm_1.Index)(["branch_id"])
], SalesOrder);
