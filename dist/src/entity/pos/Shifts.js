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
exports.Shifts = exports.ShiftStatus = void 0;
const typeorm_1 = require("typeorm");
const Payments_1 = require("./Payments");
const Branch_1 = require("../Branch");
var ShiftStatus;
(function (ShiftStatus) {
    ShiftStatus["OPEN"] = "OPEN";
    ShiftStatus["CLOSED"] = "CLOSED";
})(ShiftStatus || (exports.ShiftStatus = ShiftStatus = {}));
let Shifts = class Shifts {
};
exports.Shifts = Shifts;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Shifts.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_id", type: "uuid" }),
    __metadata("design:type", String)
], Shifts.prototype, "user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "branch_id", type: "uuid" }),
    __metadata("design:type", String)
], Shifts.prototype, "branch_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "opened_by_user_id", type: "uuid", nullable: true }),
    __metadata("design:type", String)
], Shifts.prototype, "opened_by_user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "closed_by_user_id", type: "uuid", nullable: true }),
    __metadata("design:type", String)
], Shifts.prototype, "closed_by_user_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Branch_1.Branch),
    (0, typeorm_1.JoinColumn)({ name: "branch_id" }),
    __metadata("design:type", Branch_1.Branch)
], Shifts.prototype, "branch", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)("Users"),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", Object)
], Shifts.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Shifts.prototype, "start_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Shifts.prototype, "end_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Shifts.prototype, "expected_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Shifts.prototype, "diff_amount", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: "enum", enum: ShiftStatus, default: ShiftStatus.OPEN }),
    __metadata("design:type", String)
], Shifts.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], Shifts.prototype, "open_time", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", nullable: true }),
    __metadata("design:type", Date)
], Shifts.prototype, "close_time", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Payments_1.Payments, (payment) => payment.shift),
    __metadata("design:type", Array)
], Shifts.prototype, "payments", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Shifts.prototype, "create_date", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Shifts.prototype, "update_date", void 0);
exports.Shifts = Shifts = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(["user_id"]),
    (0, typeorm_1.Index)(["branch_id"])
], Shifts);
