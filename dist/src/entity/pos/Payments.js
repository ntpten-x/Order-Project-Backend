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
exports.Payments = exports.PaymentStatus = void 0;
const typeorm_1 = require("typeorm");
const Orders_1 = require("./Orders");
const PaymentMethod_1 = require("./PaymentMethod");
const Shifts_1 = require("./Shifts");
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["Pending"] = "Pending";
    PaymentStatus["Success"] = "Success";
    PaymentStatus["Failed"] = "Failed"; // ล้มเหลว
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
let Payments = class Payments {
};
exports.Payments = Payments;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Payments.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "order_id", type: "uuid" }),
    __metadata("design:type", String)
], Payments.prototype, "order_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Orders_1.Orders, (order) => order.payments),
    (0, typeorm_1.JoinColumn)({ name: "order_id" }),
    __metadata("design:type", Orders_1.Orders)
], Payments.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "shift_id", type: "uuid", nullable: true }),
    __metadata("design:type", String)
], Payments.prototype, "shift_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Shifts_1.Shifts, (shift) => shift.payments),
    (0, typeorm_1.JoinColumn)({ name: "shift_id" }),
    __metadata("design:type", Shifts_1.Shifts)
], Payments.prototype, "shift", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "payment_method_id", type: "uuid" }),
    __metadata("design:type", String)
], Payments.prototype, "payment_method_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => PaymentMethod_1.PaymentMethod),
    (0, typeorm_1.JoinColumn)({ name: "payment_method_id" }),
    __metadata("design:type", PaymentMethod_1.PaymentMethod)
], Payments.prototype, "payment_method", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2 }),
    __metadata("design:type", Number)
], Payments.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Payments.prototype, "amount_received", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Payments.prototype, "change_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: PaymentStatus, default: PaymentStatus.Success }),
    __metadata("design:type", String)
], Payments.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], Payments.prototype, "payment_date", void 0);
exports.Payments = Payments = __decorate([
    (0, typeorm_1.Index)(["payment_date"]),
    (0, typeorm_1.Entity)()
], Payments);
