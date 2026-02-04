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
exports.Promotions = exports.PromotionCondition = exports.PromotionType = void 0;
const typeorm_1 = require("typeorm");
const Branch_1 = require("../Branch");
var PromotionType;
(function (PromotionType) {
    PromotionType["BuyXGetY"] = "BuyXGetY";
    PromotionType["PercentageOff"] = "PercentageOff";
    PromotionType["FixedAmountOff"] = "FixedAmountOff";
    PromotionType["FreeShipping"] = "FreeShipping";
    PromotionType["Bundle"] = "Bundle";
    PromotionType["MinimumPurchase"] = "MinimumPurchase"; // ซื้อขั้นต่ำ
})(PromotionType || (exports.PromotionType = PromotionType = {}));
var PromotionCondition;
(function (PromotionCondition) {
    PromotionCondition["AllProducts"] = "AllProducts";
    PromotionCondition["SpecificCategory"] = "SpecificCategory";
    PromotionCondition["SpecificProduct"] = "SpecificProduct";
    PromotionCondition["MinimumAmount"] = "MinimumAmount"; // ยอดซื้อขั้นต่ำ
})(PromotionCondition || (exports.PromotionCondition = PromotionCondition = {}));
let Promotions = class Promotions {
};
exports.Promotions = Promotions;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Promotions.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50 }),
    __metadata("design:type", String)
], Promotions.prototype, "promotion_code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200 }),
    __metadata("design:type", String)
], Promotions.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], Promotions.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "branch_id", type: "uuid" }),
    __metadata("design:type", String)
], Promotions.prototype, "branch_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Branch_1.Branch),
    (0, typeorm_1.JoinColumn)({ name: "branch_id" }),
    __metadata("design:type", Branch_1.Branch)
], Promotions.prototype, "branch", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: PromotionType }),
    __metadata("design:type", String)
], Promotions.prototype, "promotion_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: PromotionCondition }),
    __metadata("design:type", String)
], Promotions.prototype, "condition_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], Promotions.prototype, "condition_value", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Promotions.prototype, "discount_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Promotions.prototype, "discount_percentage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Promotions.prototype, "minimum_purchase", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", nullable: true }),
    __metadata("design:type", Number)
], Promotions.prototype, "buy_quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", nullable: true }),
    __metadata("design:type", Number)
], Promotions.prototype, "get_quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", nullable: true }),
    __metadata("design:type", Date)
], Promotions.prototype, "start_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", nullable: true }),
    __metadata("design:type", Date)
], Promotions.prototype, "end_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", default: 0 }),
    __metadata("design:type", Number)
], Promotions.prototype, "usage_limit", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", default: 0 }),
    __metadata("design:type", Number)
], Promotions.prototype, "usage_count", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", default: 1 }),
    __metadata("design:type", Number)
], Promotions.prototype, "usage_limit_per_user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Promotions.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], Promotions.prototype, "create_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], Promotions.prototype, "update_date", void 0);
exports.Promotions = Promotions = __decorate([
    (0, typeorm_1.Entity)("promotions"),
    (0, typeorm_1.Index)(["promotion_code", "branch_id"], { unique: true }),
    (0, typeorm_1.Index)(["branch_id", "is_active"])
], Promotions);
