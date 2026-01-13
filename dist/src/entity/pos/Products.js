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
exports.Products = void 0;
const typeorm_1 = require("typeorm");
const Category_1 = require("./Category");
const ProductsUnit_1 = require("./ProductsUnit");
let Products = class Products {
};
exports.Products = Products;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Products.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], Products.prototype, "product_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], Products.prototype, "display_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Products.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Products.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "category_id", type: "uuid" }),
    __metadata("design:type", String)
], Products.prototype, "category_id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "unit_id", type: "uuid" }),
    __metadata("design:type", String)
], Products.prototype, "unit_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], Products.prototype, "img_url", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date // วันที่สร้าง
    )
], Products.prototype, "create_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date // วันที่แก้ไขล่าสุด
    )
], Products.prototype, "update_date", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Products.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Category_1.Category, (category) => category.products),
    (0, typeorm_1.JoinColumn)({ name: "category_id" }),
    __metadata("design:type", Category_1.Category // ความสัมพันธ์เชื่อมไปยังหมวดหมู่
    )
], Products.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ProductsUnit_1.ProductsUnit, (productsUnit) => productsUnit.products),
    (0, typeorm_1.JoinColumn)({ name: "unit_id" }),
    __metadata("design:type", ProductsUnit_1.ProductsUnit // ความสัมพันธ์เชื่อมไปยังหน่วยสินค้า
    )
], Products.prototype, "unit", void 0);
exports.Products = Products = __decorate([
    (0, typeorm_1.Entity)()
], Products);
