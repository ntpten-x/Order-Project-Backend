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
exports.PurchaseOrder = exports.PurchaseOrderStatus = void 0;
const typeorm_1 = require("typeorm");
const Users_1 = require("../Users");
const OrdersItem_1 = require("./OrdersItem");
const Branch_1 = require("../Branch");
var PurchaseOrderStatus;
(function (PurchaseOrderStatus) {
    PurchaseOrderStatus["PENDING"] = "pending";
    PurchaseOrderStatus["COMPLETED"] = "completed";
    PurchaseOrderStatus["CANCELLED"] = "cancelled";
})(PurchaseOrderStatus || (exports.PurchaseOrderStatus = PurchaseOrderStatus = {}));
let PurchaseOrder = class PurchaseOrder {
};
exports.PurchaseOrder = PurchaseOrder;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], PurchaseOrder.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Users_1.Users),
    (0, typeorm_1.JoinColumn)({ name: "ordered_by_id" }),
    __metadata("design:type", Users_1.Users)
], PurchaseOrder.prototype, "ordered_by", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "ordered_by_id", type: "uuid" }),
    __metadata("design:type", String)
], PurchaseOrder.prototype, "ordered_by_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], PurchaseOrder.prototype, "remark", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "branch_id", type: "uuid" }),
    __metadata("design:type", String)
], PurchaseOrder.prototype, "branch_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Branch_1.Branch),
    (0, typeorm_1.JoinColumn)({ name: "branch_id" }),
    __metadata("design:type", Branch_1.Branch)
], PurchaseOrder.prototype, "branch", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({
        type: "enum",
        enum: PurchaseOrderStatus,
        default: PurchaseOrderStatus.PENDING
    }),
    __metadata("design:type", String)
], PurchaseOrder.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], PurchaseOrder.prototype, "create_date", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date
    // I need to update StockOrdersItem relation too.
    )
], PurchaseOrder.prototype, "update_date", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => OrdersItem_1.StockOrdersItem, (ordersItem) => ordersItem.orders)
    // This relation name in OrdersItem is likely 'orders'. I should probably update that too? 
    // Just renaming Entity first.
    ,
    __metadata("design:type", Array)
], PurchaseOrder.prototype, "ordersItems", void 0);
exports.PurchaseOrder = PurchaseOrder = __decorate([
    (0, typeorm_1.Entity)("stock_orders") // Kept "stock_orders" table to preserve data
    // If I change @Entity("stock_orders") to @Entity("purchase_orders"), it might drop data if sync is on.
    // Safest is to keep table name "stock_orders" BUT rename Entity to PurchaseOrder.
    // User said "Entity Name".
    // Let's stick to "stock_orders" table for now to preserve data, OR ask user. 
    // Given "I want to resolve naming conflict", the TypeScript class name is key.
    // But if I want to be thorough, I should rename table too.
    // However, `stock_orders` table name is fine.
    ,
    (0, typeorm_1.Index)("IDX_STOCK_ORDERS_STATUS_DATE", ["status", "create_date"])
], PurchaseOrder);
