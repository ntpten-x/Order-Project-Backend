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
const orderStatus_1 = require("../../utils/orderStatus");
const shiftSummary_utils_1 = require("./shiftSummary.utils");
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
            if (!branchId) {
                throw new AppError_1.AppError("Branch context is required to open shift", 400);
            }
            const normalizedStartAmount = isNaN(startAmount) ? 0 : startAmount;
            const shift = yield (0, dbContext_1.runInTransaction)((manager) => __awaiter(this, void 0, void 0, function* () {
                const repo = manager.getRepository(Shifts_1.Shifts);
                const activeShift = yield repo.findOne({
                    where: {
                        branch_id: branchId,
                        status: Shifts_1.ShiftStatus.OPEN
                    }
                });
                if (activeShift) {
                    return activeShift;
                }
                const newShift = repo.create({
                    user_id: userId,
                    opened_by_user_id: userId,
                    branch_id: branchId,
                    start_amount: normalizedStartAmount,
                    status: Shifts_1.ShiftStatus.OPEN,
                    open_time: new Date()
                });
                return yield repo.save(newShift);
            })).catch((error) => __awaiter(this, void 0, void 0, function* () {
                if ((error === null || error === void 0 ? void 0 : error.code) === "23505") {
                    const existing = yield this.shiftsRepo.findOne({
                        where: {
                            branch_id: branchId,
                            status: Shifts_1.ShiftStatus.OPEN
                        }
                    });
                    if (existing)
                        return existing;
                }
                throw error;
            }));
            this.socketService.emitToBranch(branchId, realtimeEvents_1.RealtimeEvents.shifts.update, shift);
            return shift;
        });
    }
    getCurrentShift(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!branchId)
                return null;
            return yield this.shiftsRepo.findOne({
                where: {
                    branch_id: branchId,
                    status: Shifts_1.ShiftStatus.OPEN
                }
            });
        });
    }
    closeShift(branchId, endAmount, closedByUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const activeShift = yield this.getCurrentShift(branchId);
            if (!activeShift) {
                throw new AppError_1.AppError("ไม่พบกะที่กำลังทำงานอยู่", 404);
            }
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
            const payments = yield this.paymentsRepo.find({
                where: { shift_id: activeShift.id, status: Payments_1.PaymentStatus.Success }
            });
            const totalSales = Math.round((0, shiftSummary_utils_1.sumPaymentAmount)(payments) * 100) / 100;
            const expectedAmount = Math.round((Number(activeShift.start_amount) + totalSales) * 100) / 100;
            activeShift.end_amount = endAmount;
            activeShift.expected_amount = expectedAmount;
            activeShift.diff_amount = Math.round((Number(endAmount) - expectedAmount) * 100) / 100;
            activeShift.status = Shifts_1.ShiftStatus.CLOSED;
            activeShift.close_time = new Date();
            if (closedByUserId) {
                activeShift.closed_by_user_id = closedByUserId;
            }
            const savedShift = yield this.shiftsRepo.save(activeShift);
            this.socketService.emitToBranch(branchId, realtimeEvents_1.RealtimeEvents.shifts.update, savedShift);
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
            const payments = (0, shiftSummary_utils_1.filterSuccessfulPayments)(shift.payments || []);
            const totalSales = Math.round((0, shiftSummary_utils_1.sumPaymentAmount)(payments) * 100) / 100;
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
            const seenOrderIds = new Set();
            payments.forEach(payment => {
                var _a;
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
                    if ((0, orderStatus_1.isCancelledStatus)(item.status))
                        return;
                    const qty = Number(item.quantity);
                    const cost = Number(((_a = item.product) === null || _a === void 0 ? void 0 : _a.cost) || 0);
                    const revenue = Number(item.total_price);
                    totalCost += cost * qty;
                    const catName = ((_c = (_b = item.product) === null || _b === void 0 ? void 0 : _b.category) === null || _c === void 0 ? void 0 : _c.display_name) || "อื่นๆ";
                    categoryCounts[catName] = (categoryCounts[catName] || 0) + qty;
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
    getShiftHistory(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { branchId, page = 1, limit = 20, q, status, dateFrom, dateTo } = options;
            const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
            const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 20;
            const applyFilters = (qb) => {
                qb.where("shift.branch_id = :branchId", { branchId });
                if (status) {
                    qb.andWhere("shift.status = :status", { status });
                }
                const keyword = q === null || q === void 0 ? void 0 : q.trim();
                if (keyword) {
                    qb.andWhere("(CAST(shift.id AS text) ILIKE :q OR user.username ILIKE :q OR user.name ILIKE :q)", { q: `%${keyword}%` });
                }
                if (dateFrom) {
                    qb.andWhere("shift.open_time >= :dateFrom", { dateFrom });
                }
                if (dateTo) {
                    qb.andWhere("shift.open_time <= :dateTo", { dateTo });
                }
                return qb;
            };
            const historyQuery = this.shiftsRepo
                .createQueryBuilder("shift")
                .leftJoinAndSelect("shift.user", "user");
            applyFilters(historyQuery);
            const [rows, total] = yield historyQuery
                .orderBy("shift.open_time", "DESC")
                .skip((safePage - 1) * safeLimit)
                .take(safeLimit)
                .getManyAndCount();
            const statsQuery = this.shiftsRepo
                .createQueryBuilder("shift")
                .leftJoin("shift.user", "user")
                .select("COUNT(shift.id)", "total_count")
                .addSelect("COALESCE(SUM(CASE WHEN shift.status = :openStatus THEN 1 ELSE 0 END), 0)", "open_count")
                .addSelect("COALESCE(SUM(CASE WHEN shift.status = :closedStatus THEN 1 ELSE 0 END), 0)", "closed_count")
                .addSelect("COALESCE(SUM(shift.start_amount), 0)", "total_start_amount")
                .addSelect("COALESCE(SUM(shift.end_amount), 0)", "total_end_amount")
                .addSelect("COALESCE(SUM(shift.expected_amount), 0)", "total_expected_amount")
                .addSelect("COALESCE(SUM(shift.diff_amount), 0)", "total_diff_amount")
                .setParameters({
                openStatus: Shifts_1.ShiftStatus.OPEN,
                closedStatus: Shifts_1.ShiftStatus.CLOSED
            });
            applyFilters(statsQuery);
            const statsRaw = yield statsQuery.getRawOne();
            const data = rows.map((shift) => ({
                id: shift.id,
                user_id: shift.user_id,
                opened_by_user_id: shift.opened_by_user_id || null,
                closed_by_user_id: shift.closed_by_user_id || null,
                start_amount: Number(shift.start_amount || 0),
                end_amount: shift.end_amount !== undefined && shift.end_amount !== null ? Number(shift.end_amount) : null,
                expected_amount: shift.expected_amount !== undefined && shift.expected_amount !== null ? Number(shift.expected_amount) : null,
                diff_amount: shift.diff_amount !== undefined && shift.diff_amount !== null ? Number(shift.diff_amount) : null,
                status: shift.status,
                open_time: shift.open_time,
                close_time: shift.close_time || null,
                create_date: shift.create_date,
                update_date: shift.update_date,
                user: shift.user
                    ? {
                        id: shift.user.id,
                        username: shift.user.username,
                        name: shift.user.name || null
                    }
                    : null
            }));
            const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
            return {
                data,
                pagination: {
                    page: safePage,
                    limit: safeLimit,
                    total,
                    total_pages: totalPages,
                    has_next: safePage < totalPages,
                    has_prev: safePage > 1
                },
                stats: {
                    total: Number((statsRaw === null || statsRaw === void 0 ? void 0 : statsRaw.total_count) || 0),
                    open: Number((statsRaw === null || statsRaw === void 0 ? void 0 : statsRaw.open_count) || 0),
                    closed: Number((statsRaw === null || statsRaw === void 0 ? void 0 : statsRaw.closed_count) || 0),
                    total_start_amount: Number((statsRaw === null || statsRaw === void 0 ? void 0 : statsRaw.total_start_amount) || 0),
                    total_end_amount: Number((statsRaw === null || statsRaw === void 0 ? void 0 : statsRaw.total_end_amount) || 0),
                    total_expected_amount: Number((statsRaw === null || statsRaw === void 0 ? void 0 : statsRaw.total_expected_amount) || 0),
                    total_diff_amount: Number((statsRaw === null || statsRaw === void 0 ? void 0 : statsRaw.total_diff_amount) || 0)
                }
            };
        });
    }
}
exports.ShiftsService = ShiftsService;
