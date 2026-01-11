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
exports.Orders = exports.OrderStatus = void 0;
const typeorm_1 = require("typeorm");
const Users_1 = require("../Users");
const OrdersItem_1 = require("./OrdersItem");
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "pending";
    OrderStatus["COMPLETED"] = "completed";
    OrderStatus["CANCELLED"] = "cancelled";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
let Orders = class Orders {
};
exports.Orders = Orders;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Orders.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Users_1.Users),
    (0, typeorm_1.JoinColumn)({ name: "ordered_by_id" }),
    __metadata("design:type", Users_1.Users)
], Orders.prototype, "ordered_by", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "ordered_by_id", type: "uuid" }),
    __metadata("design:type", String)
], Orders.prototype, "ordered_by_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], Orders.prototype, "remark", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({
        type: "enum",
        enum: OrderStatus,
        default: OrderStatus.PENDING
    }),
    __metadata("design:type", String)
], Orders.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], Orders.prototype, "create_date", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], Orders.prototype, "update_date", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => OrdersItem_1.OrdersItem, (ordersItem) => ordersItem.orders),
    __metadata("design:type", Array)
], Orders.prototype, "ordersItems", void 0);
exports.Orders = Orders = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)("IDX_ORDERS_STATUS_DATE", ["status", "create_date"])
], Orders);
