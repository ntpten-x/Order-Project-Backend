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
exports.Users = void 0;
const typeorm_1 = require("typeorm");
const Roles_1 = require("./Roles");
const Branch_1 = require("./Branch");
let Users = class Users {
};
exports.Users = Users;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Users.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, unique: true }),
    __metadata("design:type", String)
], Users.prototype, "username", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", String)
], Users.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], Users.prototype, "password", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], Users.prototype, "create_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", nullable: true }),
    __metadata("design:type", Date)
], Users.prototype, "last_login_at", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "roles_id", type: "uuid" }),
    __metadata("design:type", String)
], Users.prototype, "roles_id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Users.prototype, "is_use", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], Users.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Roles_1.Roles, (roles) => roles.users),
    (0, typeorm_1.JoinColumn)({ name: "roles_id" }),
    __metadata("design:type", Roles_1.Roles)
], Users.prototype, "roles", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "branch_id", type: "uuid" }),
    __metadata("design:type", String)
], Users.prototype, "branch_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Branch_1.Branch),
    (0, typeorm_1.JoinColumn)({ name: "branch_id" }),
    __metadata("design:type", Branch_1.Branch)
], Users.prototype, "branch", void 0);
exports.Users = Users = __decorate([
    (0, typeorm_1.Entity)()
], Users);
