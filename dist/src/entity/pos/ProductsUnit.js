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
exports.ProductsUnit = void 0;
const typeorm_1 = require("typeorm");
const Products_1 = require("./Products");
const Branch_1 = require("../Branch");
let ProductsUnit = class ProductsUnit {
};
exports.ProductsUnit = ProductsUnit;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], ProductsUnit.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], ProductsUnit.prototype, "unit_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], ProductsUnit.prototype, "display_name", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "branch_id", type: "uuid", nullable: true }),
    __metadata("design:type", String)
], ProductsUnit.prototype, "branch_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Branch_1.Branch),
    (0, typeorm_1.JoinColumn)({ name: "branch_id" }),
    __metadata("design:type", Branch_1.Branch)
], ProductsUnit.prototype, "branch", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date // วันที่สร้าง
    )
], ProductsUnit.prototype, "create_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date // วันที่แก้ไข
    )
], ProductsUnit.prototype, "update_date", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], ProductsUnit.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Products_1.Products, (products) => products.unit),
    __metadata("design:type", Array)
], ProductsUnit.prototype, "products", void 0);
exports.ProductsUnit = ProductsUnit = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(["unit_name", "branch_id"], { unique: true }),
    (0, typeorm_1.Index)(["display_name", "branch_id"], { unique: true })
], ProductsUnit);
