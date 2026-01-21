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
exports.StockOrdersItem = void 0;
const typeorm_1 = require("typeorm");
const Ingredients_1 = require("./Ingredients");
const Orders_1 = require("./Orders");
const OrdersDetail_1 = require("./OrdersDetail");
let StockOrdersItem = class StockOrdersItem {
};
exports.StockOrdersItem = StockOrdersItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], StockOrdersItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "ingredient_id", type: "uuid" }),
    __metadata("design:type", String)
], StockOrdersItem.prototype, "ingredient_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Ingredients_1.Ingredients),
    (0, typeorm_1.JoinColumn)({ name: "ingredient_id" }),
    __metadata("design:type", Ingredients_1.Ingredients)
], StockOrdersItem.prototype, "ingredient", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "orders_id", type: "uuid" }),
    __metadata("design:type", String)
], StockOrdersItem.prototype, "orders_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Orders_1.StockOrders, (orders) => orders.ordersItems, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: "orders_id" }),
    __metadata("design:type", Orders_1.StockOrders)
], StockOrdersItem.prototype, "orders", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "quantity_ordered", type: "int" }),
    __metadata("design:type", Number)
], StockOrdersItem.prototype, "quantity_ordered", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => OrdersDetail_1.StockOrdersDetail, (ordersDetail) => ordersDetail.ordersItem),
    __metadata("design:type", OrdersDetail_1.StockOrdersDetail)
], StockOrdersItem.prototype, "ordersDetail", void 0);
exports.StockOrdersItem = StockOrdersItem = __decorate([
    (0, typeorm_1.Entity)("stock_orders_item")
], StockOrdersItem);
