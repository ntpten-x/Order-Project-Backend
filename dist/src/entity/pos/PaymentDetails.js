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
exports.PaymentDetails = void 0;
const typeorm_1 = require("typeorm");
const Payment_1 = require("./Payment");
let PaymentDetails = class PaymentDetails {
};
exports.PaymentDetails = PaymentDetails;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], PaymentDetails.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "payment_id", type: "uuid" }),
    __metadata("design:type", String)
], PaymentDetails.prototype, "payment_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Payment_1.Payments, (payment) => payment.payment_details),
    (0, typeorm_1.JoinColumn)({ name: "payment_id" }),
    __metadata("design:type", Payment_1.Payments)
], PaymentDetails.prototype, "payment", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], PaymentDetails.prototype, "ref_no", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], PaymentDetails.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "json", nullable: true }),
    __metadata("design:type", Object)
], PaymentDetails.prototype, "json_metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], PaymentDetails.prototype, "create_date", void 0);
exports.PaymentDetails = PaymentDetails = __decorate([
    (0, typeorm_1.Entity)()
], PaymentDetails);
