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
exports.OrderQueue = exports.QueuePriority = exports.QueueStatus = void 0;
const typeorm_1 = require("typeorm");
const SalesOrder_1 = require("./SalesOrder");
const Branch_1 = require("../Branch");
var QueueStatus;
(function (QueueStatus) {
    QueueStatus["Pending"] = "Pending";
    QueueStatus["Processing"] = "Processing";
    QueueStatus["Completed"] = "Completed";
    QueueStatus["Cancelled"] = "Cancelled"; // ยกเลิก
})(QueueStatus || (exports.QueueStatus = QueueStatus = {}));
var QueuePriority;
(function (QueuePriority) {
    QueuePriority["Low"] = "Low";
    QueuePriority["Normal"] = "Normal";
    QueuePriority["High"] = "High";
    QueuePriority["Urgent"] = "Urgent"; // ด่วน
})(QueuePriority || (exports.QueuePriority = QueuePriority = {}));
let OrderQueue = class OrderQueue {
};
exports.OrderQueue = OrderQueue;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], OrderQueue.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "order_id", type: "uuid" }),
    __metadata("design:type", String)
], OrderQueue.prototype, "order_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SalesOrder_1.SalesOrder),
    (0, typeorm_1.JoinColumn)({ name: "order_id" }),
    __metadata("design:type", SalesOrder_1.SalesOrder)
], OrderQueue.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "branch_id", type: "uuid", nullable: true }),
    __metadata("design:type", String)
], OrderQueue.prototype, "branch_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Branch_1.Branch),
    (0, typeorm_1.JoinColumn)({ name: "branch_id" }),
    __metadata("design:type", Branch_1.Branch)
], OrderQueue.prototype, "branch", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: QueueStatus, default: QueueStatus.Pending }),
    __metadata("design:type", String)
], OrderQueue.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: QueuePriority, default: QueuePriority.Normal }),
    __metadata("design:type", String)
], OrderQueue.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", default: 0 }),
    __metadata("design:type", Number)
], OrderQueue.prototype, "queue_position", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", nullable: true }),
    __metadata("design:type", Date)
], OrderQueue.prototype, "started_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", nullable: true }),
    __metadata("design:type", Date)
], OrderQueue.prototype, "completed_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], OrderQueue.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], OrderQueue.prototype, "created_at", void 0);
exports.OrderQueue = OrderQueue = __decorate([
    (0, typeorm_1.Entity)("order_queue"),
    (0, typeorm_1.Index)(["order_id"], { unique: true }),
    (0, typeorm_1.Index)(["branch_id", "status"]),
    (0, typeorm_1.Index)(["priority", "created_at"])
], OrderQueue);
