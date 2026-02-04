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
exports.PaymentsService = void 0;
const socket_service_1 = require("../socket.service");
const Payments_1 = require("../../entity/pos/Payments");
const shifts_service_1 = require("./shifts.service");
const AppError_1 = require("../../utils/AppError");
const SalesOrder_1 = require("../../entity/pos/SalesOrder");
const OrderEnums_1 = require("../../entity/pos/OrderEnums");
const Tables_1 = require("../../entity/pos/Tables");
const PaymentMethod_1 = require("../../entity/pos/PaymentMethod");
const dbContext_1 = require("../../database/dbContext");
class PaymentsService {
    constructor(paymentsModel) {
        this.paymentsModel = paymentsModel;
        this.socketService = socket_service_1.SocketService.getInstance();
        this.shiftsService = new shifts_service_1.ShiftsService();
    }
    findAll(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentsModel.findAll(branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentsModel.findOne(id, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    refreshOrderPaymentSummary(orderId_1) {
        return __awaiter(this, arguments, void 0, function* (orderId, manager = (0, dbContext_1.getDbManager)(), branchId) {
            const orderRepo = manager.getRepository(SalesOrder_1.SalesOrder);
            const paymentsRepo = manager.getRepository(Payments_1.Payments);
            const tablesRepo = manager.getRepository(Tables_1.Tables);
            const order = yield orderRepo.findOne({ where: branchId ? { id: orderId, branch_id: branchId } : { id: orderId } });
            if (!order)
                return;
            const payments = yield paymentsRepo.find({
                where: { order_id: orderId, status: Payments_1.PaymentStatus.Success }
            });
            const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const totalReceived = payments.reduce((sum, p) => sum + Number(p.amount_received || 0), 0);
            const totalChange = payments.reduce((sum, p) => sum + Number(p.change_amount || 0), 0);
            const nextStatus = order.status === OrderEnums_1.OrderStatus.Cancelled
                ? OrderEnums_1.OrderStatus.Cancelled
                : totalPaid >= Number(order.total_amount)
                    ? OrderEnums_1.OrderStatus.Completed // Order is Completed
                    : order.status;
            yield orderRepo.update(orderId, {
                received_amount: totalReceived,
                change_amount: totalChange,
                status: nextStatus
            });
            // Loop update all items to Paid if Order is Completed
            if (nextStatus === OrderEnums_1.OrderStatus.Completed) {
                // Logic to update all items to Paid could go here or be assumed by Completed status
                // ideally we explicitly update them as per requirement "Items... Paid"
                // But let's first check if we should do it here. The prompt says "Items ... Paid".
                // We can do a bulk update.
                const effectiveBranchId = order.branch_id || branchId;
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, 'orders:update', Object.assign(Object.assign({}, order), { status: nextStatus }));
                }
                // Update all items to Paid
                //  const itemsRepo = manager.getRepository(SalesOrderItem); // Need to import or use QueryBuilder
                //  await itemsRepo.update({ order_id: orderId }, { status: OrderStatus.Paid });
                // Wait, removing imports might be messy if I don't check what's imported.
                // Let's use custom query or existing connection.
                yield manager.query(`UPDATE sales_order_item SET status = $1 WHERE order_id = $2`, [OrderEnums_1.OrderStatus.Paid, orderId]);
            }
            if (nextStatus === OrderEnums_1.OrderStatus.Completed && order.table_id) {
                yield tablesRepo.update(order.table_id, { status: Tables_1.TableStatus.Available });
                const t = yield tablesRepo.findOneBy({ id: order.table_id });
                if (t) {
                    const effectiveBranchId = order.branch_id || branchId;
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, "tables:update", t);
                    }
                }
            }
            const refreshedOrder = yield orderRepo.findOne({ where: branchId ? { id: orderId, branch_id: branchId } : { id: orderId } });
            if (refreshedOrder) {
                const effectiveBranchId = refreshedOrder.branch_id || branchId;
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, "orders:update", refreshedOrder);
                }
            }
        });
    }
    create(payments, userId, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, dbContext_1.runInTransaction)((manager) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!payments.order_id) {
                        throw new Error("กรุณาระบุรหัสออเดอร์");
                    }
                    if (!payments.payment_method_id) {
                        throw new Error("กรุณาระบุรหัสวิธีการชำระเงิน");
                    }
                    const amount = Number(payments.amount);
                    if (!Number.isFinite(amount) || amount <= 0) {
                        throw new Error("ยอดเงินที่ชำระต้องมากกว่า 0");
                    }
                    const orderRepo = manager.getRepository(SalesOrder_1.SalesOrder);
                    const order = yield orderRepo.findOne({ where: branchId ? { id: payments.order_id, branch_id: branchId } : { id: payments.order_id } });
                    if (!order) {
                        throw new AppError_1.AppError("ไม่พบออเดอร์", 404);
                    }
                    if (order.status === OrderEnums_1.OrderStatus.Cancelled) {
                        throw new AppError_1.AppError("ออเดอร์ถูกยกเลิกแล้ว", 400);
                    }
                    const effectiveBranchId = order.branch_id || branchId;
                    if (effectiveBranchId) {
                        payments.branch_id = effectiveBranchId;
                    }
                    // Validate payment method belongs to branch
                    if (effectiveBranchId) {
                        const pm = yield manager.getRepository(PaymentMethod_1.PaymentMethod).findOneBy({ id: payments.payment_method_id, branch_id: effectiveBranchId });
                        if (!pm)
                            throw new AppError_1.AppError("Payment method not found for this branch", 404);
                    }
                    const amountReceived = payments.amount_received !== undefined ? Number(payments.amount_received) : amount;
                    if (!Number.isFinite(amountReceived) || amountReceived < amount) {
                        throw new AppError_1.AppError("ยอดเงินที่รับต้องไม่น้อยกว่ายอดชำระ", 400);
                    }
                    payments.amount = amount;
                    payments.amount_received = amountReceived;
                    payments.change_amount = Number((amountReceived - amount).toFixed(2));
                    // Link to Active Shift
                    const activeShift = yield this.shiftsService.getCurrentShift(userId);
                    if (!activeShift) {
                        throw new AppError_1.AppError("กรุณาเปิดกะก่อนทำรายการชำระเงิน (Open Shift Required)", 400);
                    }
                    payments.shift_id = activeShift.id;
                    const createdPayment = yield this.paymentsModel.create(payments, manager);
                    yield this.refreshOrderPaymentSummary(createdPayment.order_id, manager, branchId);
                    return createdPayment;
                }
                catch (error) {
                    throw error;
                }
            })).then((createdPayment) => __awaiter(this, void 0, void 0, function* () {
                // Fetch complete data with relations to return AFTER transaction commits
                const completePayment = yield this.paymentsModel.findOne(createdPayment.id, branchId);
                if (completePayment) {
                    const effectiveBranchId = completePayment.branch_id || branchId;
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, 'payments:create', completePayment);
                    }
                    return completePayment;
                }
                return createdPayment;
            }));
        });
    }
    update(id, payments, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, dbContext_1.runInTransaction)((manager) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c;
                try {
                    const paymentToUpdate = yield this.paymentsModel.findOne(id, branchId); // Read-only is fine outside, but for strictness we could re-query inside. 
                    // However, findOne in model typically uses default repo. Let's assume concurrency is handled by optimistic check or DB locks if critical.
                    // For now, re-reading inside isn't easy without exposing manager to model fully.
                    // But we CAN use manager here.
                    const paymentsRepo = manager.getRepository(Payments_1.Payments);
                    const existingPayment = yield paymentsRepo.findOneBy(branchId ? { id, branch_id: branchId } : { id });
                    if (!existingPayment) {
                        throw new Error("ไม่พบข้อมูลการชำระเงินที่ต้องการแก้ไข");
                    }
                    if (payments.order_id && payments.order_id !== existingPayment.order_id) {
                        throw new AppError_1.AppError("ไม่สามารถเปลี่ยนออเดอร์ของรายการชำระเงินได้", 400);
                    }
                    if (payments.amount !== undefined) {
                        const amount = Number(payments.amount);
                        if (!Number.isFinite(amount) || amount <= 0) {
                            throw new AppError_1.AppError("ยอดเงินที่ชำระต้องมากกว่า 0", 400);
                        }
                        payments.amount = amount;
                    }
                    if (payments.amount_received !== undefined || payments.amount !== undefined) {
                        const amount = Number((_a = payments.amount) !== null && _a !== void 0 ? _a : existingPayment.amount);
                        const amountReceived = Number((_c = (_b = payments.amount_received) !== null && _b !== void 0 ? _b : existingPayment.amount_received) !== null && _c !== void 0 ? _c : amount);
                        if (!Number.isFinite(amountReceived) || amountReceived < amount) {
                            throw new AppError_1.AppError("ยอดเงินที่รับต้องไม่น้อยกว่ายอดชำระ", 400);
                        }
                        payments.amount_received = amountReceived;
                        payments.change_amount = Number((amountReceived - amount).toFixed(2));
                    }
                    const effectiveBranchId = existingPayment.branch_id || branchId;
                    if (effectiveBranchId) {
                        payments.branch_id = effectiveBranchId;
                    }
                    if (payments.payment_method_id && effectiveBranchId) {
                        const pm = yield manager.getRepository(PaymentMethod_1.PaymentMethod).findOneBy({ id: payments.payment_method_id, branch_id: effectiveBranchId });
                        if (!pm)
                            throw new AppError_1.AppError("Payment method not found for this branch", 404);
                    }
                    // Use model update with manager if possible, or repo update
                    yield this.paymentsModel.update(id, payments, manager);
                    yield this.refreshOrderPaymentSummary(existingPayment.order_id, manager, branchId);
                    return existingPayment; // return placeholder, will refresh outside
                }
                catch (error) {
                    throw error;
                }
            })).then(() => __awaiter(this, void 0, void 0, function* () {
                const updatedPayment = yield this.paymentsModel.findOne(id, branchId);
                if (updatedPayment) {
                    const effectiveBranchId = updatedPayment.branch_id || branchId;
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, 'payments:update', updatedPayment);
                    }
                    return updatedPayment;
                }
                throw new Error("Critical: Failed to retrieve updated payment");
            }));
        });
    }
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, dbContext_1.runInTransaction)((manager) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const paymentsRepo = manager.getRepository(Payments_1.Payments);
                    const payment = yield paymentsRepo.findOneBy(branchId ? { id, branch_id: branchId } : { id });
                    if (!payment) {
                        throw new AppError_1.AppError("Payment not found", 404);
                    }
                    yield this.paymentsModel.delete(id, manager);
                    if (payment.order_id) {
                        yield this.refreshOrderPaymentSummary(payment.order_id, manager, branchId);
                    }
                }
                catch (error) {
                    throw error;
                }
            })).then(() => {
                if (branchId) {
                    this.socketService.emitToBranch(branchId, 'payments:delete', { id });
                }
            });
        });
    }
}
exports.PaymentsService = PaymentsService;
