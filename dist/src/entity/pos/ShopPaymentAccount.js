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
exports.ShopPaymentAccount = exports.AccountType = void 0;
const typeorm_1 = require("typeorm");
const ShopProfile_1 = require("./ShopProfile");
var AccountType;
(function (AccountType) {
    AccountType["PROMPTPAY"] = "PromptPay";
    AccountType["BANK_ACCOUNT"] = "BankAccount";
})(AccountType || (exports.AccountType = AccountType = {}));
let ShopPaymentAccount = class ShopPaymentAccount {
};
exports.ShopPaymentAccount = ShopPaymentAccount;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], ShopPaymentAccount.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "uuid" }),
    __metadata("design:type", String)
], ShopPaymentAccount.prototype, "shop_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ShopProfile_1.ShopProfile, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "shop_id" }),
    __metadata("design:type", ShopProfile_1.ShopProfile)
], ShopPaymentAccount.prototype, "shop", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], ShopPaymentAccount.prototype, "account_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50 }),
    __metadata("design:type", String)
], ShopPaymentAccount.prototype, "account_number", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", String)
], ShopPaymentAccount.prototype, "bank_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], ShopPaymentAccount.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", String)
], ShopPaymentAccount.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, default: AccountType.PROMPTPAY }),
    __metadata("design:type", String)
], ShopPaymentAccount.prototype, "account_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], ShopPaymentAccount.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], ShopPaymentAccount.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], ShopPaymentAccount.prototype, "updated_at", void 0);
exports.ShopPaymentAccount = ShopPaymentAccount = __decorate([
    (0, typeorm_1.Entity)()
], ShopPaymentAccount);
