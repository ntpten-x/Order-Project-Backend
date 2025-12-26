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
exports.Ingredients = void 0;
const typeorm_1 = require("typeorm");
const IngredientsUnit_1 = require("./IngredientsUnit");
let Ingredients = class Ingredients {
};
exports.Ingredients = Ingredients;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Ingredients.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, unique: true }),
    __metadata("design:type", String)
], Ingredients.prototype, "ingredient_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, unique: true }),
    __metadata("design:type", String)
], Ingredients.prototype, "display_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Ingredients.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Ingredients.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], Ingredients.prototype, "img_url", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "uuid" }),
    __metadata("design:type", String)
], Ingredients.prototype, "unit_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], Ingredients.prototype, "create_date", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => IngredientsUnit_1.IngredientsUnit, (ingredientsUnit) => ingredientsUnit.ingredients),
    (0, typeorm_1.JoinColumn)({ name: "unit_id" }),
    __metadata("design:type", IngredientsUnit_1.IngredientsUnit)
], Ingredients.prototype, "unit", void 0);
exports.Ingredients = Ingredients = __decorate([
    (0, typeorm_1.Entity)()
], Ingredients);
