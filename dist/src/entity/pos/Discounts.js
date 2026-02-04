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
exports.Discounts = exports.DiscountType = void 0;
const typeorm_1 = require("typeorm");
const Branch_1 = require("../Branch");
var DiscountType;
(function (DiscountType) {
    DiscountType["Fixed"] = "Fixed";
    DiscountType["Percentage"] = "Percentage"; // ลดเป็นเปอร์เซ็นต์ (%)
})(DiscountType || (exports.DiscountType = DiscountType = {}));
let Discounts = class Discounts {
};
exports.Discounts = Discounts;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Discounts.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], Discounts.prototype, "discount_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], Discounts.prototype, "display_name", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "branch_id", type: "uuid" }),
    __metadata("design:type", String)
], Discounts.prototype, "branch_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Branch_1.Branch),
    (0, typeorm_1.JoinColumn)({ name: "branch_id" }),
    __metadata("design:type", Branch_1.Branch)
], Discounts.prototype, "branch", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], Discounts.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Discounts.prototype, "discount_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: DiscountType }),
    __metadata("design:type", String)
], Discounts.prototype, "discount_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Discounts.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date // วันที่สร้าง
    )
], Discounts.prototype, "create_date", void 0);
exports.Discounts = Discounts = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(["discount_name", "branch_id"], { unique: true }),
    (0, typeorm_1.Index)(["display_name", "branch_id"], { unique: true })
], Discounts);
