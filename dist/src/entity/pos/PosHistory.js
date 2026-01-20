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
exports.PosHistory = void 0;
const typeorm_1 = require("typeorm");
const OrderEnums_1 = require("./OrderEnums");
let PosHistory = class PosHistory {
};
exports.PosHistory = PosHistory;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], PosHistory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "order_id", type: "uuid", nullable: true }),
    __metadata("design:type", String)
], PosHistory.prototype, "order_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], PosHistory.prototype, "order_no", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: OrderEnums_1.OrderType, nullable: true }),
    __metadata("design:type", String)
], PosHistory.prototype, "order_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "table_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], PosHistory.prototype, "table_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "delivery_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], PosHistory.prototype, "delivery_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "created_by_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], PosHistory.prototype, "created_by_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], PosHistory.prototype, "sub_total", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], PosHistory.prototype, "discount_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], PosHistory.prototype, "vat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], PosHistory.prototype, "total_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], PosHistory.prototype, "received_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], PosHistory.prototype, "change_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: OrderEnums_1.OrderStatus }),
    __metadata("design:type", String)
], PosHistory.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], PosHistory.prototype, "create_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], PosHistory.prototype, "end_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], PosHistory.prototype, "items_snapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], PosHistory.prototype, "payments_snapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], PosHistory.prototype, "additional_data", void 0);
exports.PosHistory = PosHistory = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(["create_date"]),
    (0, typeorm_1.Index)(["end_date"]),
    (0, typeorm_1.Index)(["status"])
], PosHistory);
