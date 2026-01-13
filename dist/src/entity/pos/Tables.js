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
exports.Tables = exports.TableStatus = void 0;
const typeorm_1 = require("typeorm");
var TableStatus;
(function (TableStatus) {
    TableStatus["Available"] = "Available";
    TableStatus["Unavailable"] = "Unavailable"; // ไม่ว่าง
})(TableStatus || (exports.TableStatus = TableStatus = {}));
let Tables = class Tables {
};
exports.Tables = Tables;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Tables.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, unique: true }),
    __metadata("design:type", String)
], Tables.prototype, "table_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: TableStatus, default: TableStatus.Available }),
    __metadata("design:type", String)
], Tables.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], Tables.prototype, "create_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], Tables.prototype, "update_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Tables.prototype, "is_active", void 0);
exports.Tables = Tables = __decorate([
    (0, typeorm_1.Entity)()
], Tables);
