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
exports.ShiftsService = void 0;
const typeorm_1 = require("typeorm");
const Shifts_1 = require("../../entity/pos/Shifts");
const Payments_1 = require("../../entity/pos/Payments");
const SalesOrderItem_1 = require("../../entity/pos/SalesOrderItem");
const SalesOrder_1 = require("../../entity/pos/SalesOrder");
const OrderEnums_1 = require("../../entity/pos/OrderEnums");
const AppError_1 = require("../../utils/AppError");
const socket_service_1 = require("../socket.service");
const dbContext_1 = require("../../database/dbContext");
const realtimeEvents_1 = require("../../utils/realtimeEvents");
class ShiftsService {
    constructor() {
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    get shiftsRepo() {
        return (0, dbContext_1.getRepository)(Shifts_1.Shifts);
    }
    get paymentsRepo() {
        return (0, dbContext_1.getRepository)(Payments_1.Payments);
    }
    get salesOrderItemRepo() {
        return (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem);
    }
    get salesOrderRepo() {
        return (0, dbContext_1.getRepository)(SalesOrder_1.SalesOrder);
    }
    openShift(userId, startAmount, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if user already has an OPEN shift
            const activeShift = yield this.shiftsRepo.findOne({
                where: {
                    user_id: userId,
                    status: Shifts_1.ShiftStatus.OPEN
                }
            });
            if (activeShift) {
                throw new AppError_1.AppError("ผู้ใช้งานนี้มีกะที่เปิดอยู่แล้ว กรุณาปิดกะก่อนเปิดใหม่", 400);
            }
            const newShift = new Shifts_1.Shifts();
            newShift.user_id = userId;
            if (branchId)
                newShift.branch_id = branchId;
            newShift.start_amount = isNaN(startAmount) ? 0 : startAmount;
            newShift.status = Shifts_1.ShiftStatus.OPEN;
            newShift.open_time = new Date();
            const savedShift = yield this.shiftsRepo.save(newShift);
            if (branchId) {
                this.socketService.emitToBranch(branchId, realtimeEvents_1.RealtimeEvents.shifts.update, savedShift);
            }
            return savedShift;
        });
    }
    getCurrentShift(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.shiftsRepo.findOne({
                where: {
                    user_id: userId,
                    status: Shifts_1.ShiftStatus.OPEN
                }
            });
        });
    }
    closeShift(userId, endAmount) {
        return __awaiter(this, void 0, void 0, function* () {
            const activeShift = yield this.getCurrentShift(userId);
            if (!activeShift) {
                throw new AppError_1.AppError("ไม่พบกะที่กำลังทำงานอยู่", 404);
            }
            // Check for pending/incomplete orders
            // Only check orders created during this shift
            const pendingOrders = yield this.salesOrderRepo.count({
                where: [
                    { status: OrderEnums_1.OrderStatus.Pending, create_date: (0, typeorm_1.MoreThanOrEqual)(activeShift.open_time), branch_id: activeShift.branch_id },
                    { status: OrderEnums_1.OrderStatus.Cooking, create_date: (0, typeorm_1.MoreThanOrEqual)(activeShift.open_time), branch_id: activeShift.branch_id },
                    { status: OrderEnums_1.OrderStatus.Served, create_date: (0, typeorm_1.MoreThanOrEqual)(activeShift.open_time), branch_id: activeShift.branch_id },
                    { status: OrderEnums_1.OrderStatus.WaitingForPayment, create_date: (0, typeorm_1.MoreThanOrEqual)(activeShift.open_time), branch_id: activeShift.branch_id },
                    { status: OrderEnums_1.OrderStatus.pending, create_date: (0, typeorm_1.MoreThanOrEqual)(activeShift.open_time), branch_id: activeShift.branch_id }
                ]
            });
            if (pendingOrders > 0) {
                throw new AppError_1.AppError(`ไม่สามารถปิดกะได้ เนื่องจากยังมีออเดอร์ค้างอยู่ในระบบจำนวน ${pendingOrders} รายการ กรุณาจัดการให้เรียบร้อย (เสร็จสิ้น หรือ ยกเลิก) ก่อนปิดกะ`, 400);
            }
            // Sum of all payments linked to this shift
            const payments = yield this.paymentsRepo.find({
                where: { shift_id: activeShift.id }
            });
            const totalSales = Math.round(payments.reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100;
            // Expected Amount = Start + Sales
            // Note: In real world, we might subtract payouts/expenses. For now simple logic.
            const expectedAmount = Math.round((Number(activeShift.start_amount) + totalSales) * 100) / 100;
            activeShift.end_amount = endAmount;
            activeShift.expected_amount = expectedAmount;
            activeShift.diff_amount = Math.round((Number(endAmount) - expectedAmount) * 100) / 100;
            activeShift.status = Shifts_1.ShiftStatus.CLOSED;
            activeShift.close_time = new Date();
            const savedShift = yield this.shiftsRepo.save(activeShift);
            const branchId = activeShift.branch_id;
            if (branchId) {
                this.socketService.emitToBranch(branchId, realtimeEvents_1.RealtimeEvents.shifts.update, savedShift);
            }
            return savedShift;
        });
    }
    getShiftSummary(shiftId, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const shift = yield this.shiftsRepo.findOne({
                where: branchId ? { id: shiftId, branch_id: branchId } : { id: shiftId },
                relations: ["payments", "payments.payment_method", "payments.order", "payments.order.items", "payments.order.items.product", "payments.order.items.product.category", "payments.order.items.product.unit"]
            });
            if (!shift) {
                throw new AppError_1.AppError("ไม่พบข้อมูลกะ", 404);
            }
            const payments = shift.payments || [];
            // 1. Sales Calculation (only successful payments)
            const totalSales = Math.round(payments.reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100;
            // 2. Cost and Profit Calculation
            let totalCost = 0;
            const categoryCounts = {};
            const productSales = {};
            const paymentMethodSales = {
                "เงินสด": 0,
                "พร้อมเพย์": 0
            };
            const orderTypeSales = {
                "DineIn": 0,
                "TakeAway": 0,
                "Delivery": 0
            };
            // Track seen orders to avoid double counting items
            const seenOrderIds = new Set();
            payments.forEach(payment => {
                var _a;
                // Calculate sales by payment method
                const methodName = ((_a = payment.payment_method) === null || _a === void 0 ? void 0 : _a.display_name) || "อื่นๆ";
                paymentMethodSales[methodName] = Math.round(((paymentMethodSales[methodName] || 0) + Number(payment.amount)) * 100) / 100;
                if (payment.order) {
                    const type = payment.order.order_type;
                    orderTypeSales[type] = Math.round(((orderTypeSales[type] || 0) + Number(payment.amount)) * 100) / 100;
                }
                if (!payment.order || seenOrderIds.has(payment.order.id))
                    return;
                seenOrderIds.add(payment.order.id);
                const items = payment.order.items || [];
                items.forEach(item => {
                    var _a, _b, _c, _d, _e;
                    if (item.status === 'Cancelled')
                        return;
                    const qty = Number(item.quantity);
                    const cost = Number(((_a = item.product) === null || _a === void 0 ? void 0 : _a.cost) || 0);
                    const revenue = Number(item.total_price);
                    totalCost += cost * qty;
                    // Category counts
                    const catName = ((_c = (_b = item.product) === null || _b === void 0 ? void 0 : _b.category) === null || _c === void 0 ? void 0 : _c.display_name) || "อื่นๆ";
                    categoryCounts[catName] = (categoryCounts[catName] || 0) + qty;
                    // Product sales for top 5
                    const pId = (_d = item.product) === null || _d === void 0 ? void 0 : _d.id;
                    if (pId) {
                        if (!productSales[pId]) {
                            productSales[pId] = {
                                id: pId,
                                name: item.product.display_name,
                                quantity: 0,
                                revenue: 0,
                                unit: ((_e = item.product.unit) === null || _e === void 0 ? void 0 : _e.display_name) || "ชิ้น"
                            };
                        }
                        productSales[pId].quantity += qty;
                        productSales[pId].revenue = Math.round((productSales[pId].revenue + revenue) * 100) / 100;
                    }
                });
            });
            totalCost = Math.round(totalCost * 100) / 100;
            const netProfit = Math.round((totalSales - totalCost) * 100) / 100;
            // Top 5 Products
            const topProducts = Object.values(productSales)
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 5);
            return {
                shift_info: {
                    id: shift.id,
                    status: shift.status,
                    open_time: shift.open_time,
                    close_time: shift.close_time,
                    start_amount: Number(shift.start_amount),
                    end_amount: shift.end_amount ? Number(shift.end_amount) : null,
                    expected_amount: shift.expected_amount ? Math.round(Number(shift.expected_amount) * 100) / 100 : Math.round((Number(shift.start_amount) + totalSales) * 100) / 100,
                    diff_amount: shift.diff_amount ? Number(shift.diff_amount) : null,
                },
                summary: {
                    total_sales: totalSales,
                    total_cost: totalCost,
                    net_profit: netProfit,
                    gross_profit_margin: totalSales > 0 ? Math.round(((netProfit / totalSales) * 100) * 100) / 100 : 0,
                    payment_methods: paymentMethodSales,
                    order_types: orderTypeSales
                },
                categories: categoryCounts,
                top_products: topProducts
            };
        });
    }
}
exports.ShiftsService = ShiftsService;
