"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscountsService = void 0;
const socket_service_1 = require("../socket.service");
const realtimeEvents_1 = require("../../utils/realtimeEvents");
class DiscountsService {
    constructor(discountsModel) {
        this.discountsModel = discountsModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll(q, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.discountsModel.findAll(q, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.discountsModel.findOne(id, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(discount_name, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.discountsModel.findOneByName(discount_name, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(discounts, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!discounts.discount_name) {
                    throw new Error("กรุณาระบุชื่อส่วนลด");
                }
                const effectiveBranchId = branchId || discounts.branch_id;
                if (effectiveBranchId) {
                    discounts.branch_id = effectiveBranchId;
                }
                const existingDiscount = yield this.discountsModel.findOneByName(discounts.discount_name, effectiveBranchId);
                if (existingDiscount) {
                    throw new Error("ชื่อส่วนลดนี้มีอยู่ในระบบแล้ว");
                }
                const createdDiscount = yield this.discountsModel.create(discounts);
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.discounts.create, createdDiscount);
                }
                return createdDiscount;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, discounts, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const discountToUpdate = yield this.discountsModel.findOne(id, branchId);
                if (!discountToUpdate) {
                    throw new Error("ไม่พบข้อมูลส่วนลดที่ต้องการแก้ไข");
                }
                if (discounts.discount_name && discounts.discount_name !== discountToUpdate.discount_name) {
                    const effectiveBranchId = branchId || discountToUpdate.branch_id || discounts.branch_id;
                    if (effectiveBranchId) {
                        discounts.branch_id = effectiveBranchId;
                    }
                    const existingDiscount = yield this.discountsModel.findOneByName(discounts.discount_name, effectiveBranchId);
                    if (existingDiscount) {
                        throw new Error("ชื่อส่วนลดนี้มีอยู่ในระบบแล้ว");
                    }
                }
                const effectiveBranchId = branchId || discountToUpdate.branch_id || discounts.branch_id;
                if (effectiveBranchId) {
                    discounts.branch_id = effectiveBranchId;
                }
                const updatedDiscount = yield this.discountsModel.update(id, discounts, effectiveBranchId);
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.discounts.update, updatedDiscount);
                }
                return updatedDiscount;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existing = yield this.discountsModel.findOne(id, branchId);
                if (!existing)
                    throw new Error("Discount not found");
                const effectiveBranchId = branchId || existing.branch_id;
                yield this.discountsModel.delete(id, effectiveBranchId);
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.discounts.delete, { id });
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.DiscountsService = DiscountsService;
