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
exports.BranchStock = void 0;
const typeorm_1 = require("typeorm");
const Branch_1 = require("../Branch");
const Ingredients_1 = require("./Ingredients");
let BranchStock = class BranchStock {
};
exports.BranchStock = BranchStock;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], BranchStock.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "branch_id", type: "uuid" }),
    __metadata("design:type", String)
], BranchStock.prototype, "branch_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Branch_1.Branch),
    (0, typeorm_1.JoinColumn)({ name: "branch_id" }),
    __metadata("design:type", Branch_1.Branch)
], BranchStock.prototype, "branch", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "ingredient_id", type: "uuid" }),
    __metadata("design:type", String)
], BranchStock.prototype, "ingredient_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Ingredients_1.Ingredients),
    (0, typeorm_1.JoinColumn)({ name: "ingredient_id" }),
    __metadata("design:type", Ingredients_1.Ingredients)
], BranchStock.prototype, "ingredient", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], BranchStock.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], BranchStock.prototype, "last_updated", void 0);
exports.BranchStock = BranchStock = __decorate([
    (0, typeorm_1.Entity)("branch_stock"),
    (0, typeorm_1.Index)(["branch_id", "ingredient_id"], { unique: true })
], BranchStock);
