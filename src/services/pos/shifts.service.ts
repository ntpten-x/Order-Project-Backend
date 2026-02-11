import { MoreThanOrEqual, SelectQueryBuilder } from "typeorm";
import { Shifts, ShiftStatus } from "../../entity/pos/Shifts";
import { Payments, PaymentStatus } from "../../entity/pos/Payments";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { OrderStatus } from "../../entity/pos/OrderEnums";
import { AppError } from "../../utils/AppError";
import { SocketService } from "../socket.service";
import { getRepository, runInTransaction } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { isCancelledStatus } from "../../utils/orderStatus";
import { filterSuccessfulPayments, sumPaymentAmount } from "./shiftSummary.utils";

export class ShiftsService {
    private get shiftsRepo() {
        return getRepository(Shifts);
    }
    private get paymentsRepo() {
        return getRepository(Payments);
    }
    private get salesOrderItemRepo() {
        return getRepository(SalesOrderItem);
    }
    private get salesOrderRepo() {
        return getRepository(SalesOrder);
    }
    private socketService = SocketService.getInstance();

    async openShift(userId: string, startAmount: number, branchId?: string): Promise<Shifts> {
        if (!branchId) {
            throw new AppError("Branch context is required to open shift", 400);
        }

        const normalizedStartAmount = isNaN(startAmount) ? 0 : startAmount;

        const shift = await runInTransaction(async (manager) => {
            const repo = manager.getRepository(Shifts);
            const activeShift = await repo.findOne({
                where: {
                    branch_id: branchId,
                    status: ShiftStatus.OPEN
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
                status: ShiftStatus.OPEN,
                open_time: new Date()
            });

            return await repo.save(newShift);
        }).catch(async (error: any) => {
            if (error?.code === "23505") {
                const existing = await this.shiftsRepo.findOne({
                    where: {
                        branch_id: branchId,
                        status: ShiftStatus.OPEN
                    }
                });
                if (existing) return existing;
            }
            throw error;
        });

        this.socketService.emitToBranch(branchId, RealtimeEvents.shifts.update, shift);
        return shift;
    }

    async getCurrentShift(branchId?: string): Promise<Shifts | null> {
        if (!branchId) return null;
        return await this.shiftsRepo.findOne({
            where: {
                branch_id: branchId,
                status: ShiftStatus.OPEN
            }
        });
    }

    async closeShift(branchId: string, endAmount: number, closedByUserId?: string): Promise<Shifts> {
        const activeShift = await this.getCurrentShift(branchId);
        if (!activeShift) {
            throw new AppError("ไม่พบกะที่กำลังทำงานอยู่", 404);
        }

        const pendingOrders = await this.salesOrderRepo.count({
            where: [
                { status: OrderStatus.Pending, create_date: MoreThanOrEqual(activeShift.open_time), branch_id: activeShift.branch_id },
                { status: OrderStatus.Cooking, create_date: MoreThanOrEqual(activeShift.open_time), branch_id: activeShift.branch_id },
                { status: OrderStatus.Served, create_date: MoreThanOrEqual(activeShift.open_time), branch_id: activeShift.branch_id },
                { status: OrderStatus.WaitingForPayment, create_date: MoreThanOrEqual(activeShift.open_time), branch_id: activeShift.branch_id },
                { status: OrderStatus.pending, create_date: MoreThanOrEqual(activeShift.open_time), branch_id: activeShift.branch_id }
            ]
        });

        if (pendingOrders > 0) {
            throw new AppError(`ไม่สามารถปิดกะได้ เนื่องจากยังมีออเดอร์ค้างอยู่ในระบบจำนวน ${pendingOrders} รายการ กรุณาจัดการให้เรียบร้อย (เสร็จสิ้น หรือ ยกเลิก) ก่อนปิดกะ`, 400);
        }

        const payments = await this.paymentsRepo.find({
            where: { shift_id: activeShift.id, status: PaymentStatus.Success }
        });

        const totalSales = Math.round(sumPaymentAmount(payments) * 100) / 100;
        const expectedAmount = Math.round((Number(activeShift.start_amount) + totalSales) * 100) / 100;

        activeShift.end_amount = endAmount;
        activeShift.expected_amount = expectedAmount;
        activeShift.diff_amount = Math.round((Number(endAmount) - expectedAmount) * 100) / 100;
        activeShift.status = ShiftStatus.CLOSED;
        activeShift.close_time = new Date();
        if (closedByUserId) {
            activeShift.closed_by_user_id = closedByUserId;
        }

        const savedShift = await this.shiftsRepo.save(activeShift);
        this.socketService.emitToBranch(branchId, RealtimeEvents.shifts.update, savedShift);
        return savedShift;
    }

    async getShiftSummary(shiftId: string, branchId?: string) {
        const shift = await this.shiftsRepo.findOne({
            where: branchId ? ({ id: shiftId, branch_id: branchId } as any) : ({ id: shiftId } as any),
            relations: ["payments", "payments.payment_method", "payments.order", "payments.order.items", "payments.order.items.product", "payments.order.items.product.category", "payments.order.items.product.unit"]
        });

        if (!shift) {
            throw new AppError("ไม่พบข้อมูลกะ", 404);
        }

        const payments = filterSuccessfulPayments(shift.payments || []);

        const totalSales = Math.round(sumPaymentAmount(payments) * 100) / 100;

        let totalCost = 0;
        const categoryCounts: Record<string, number> = {};
        const productSales: Record<string, { id: string, name: string, quantity: number, revenue: number, unit: string }> = {};
        const paymentMethodSales: Record<string, number> = {
            "เงินสด": 0,
            "พร้อมเพย์": 0
        };
        const orderTypeSales: Record<string, number> = {
            "DineIn": 0,
            "TakeAway": 0,
            "Delivery": 0
        };

        const seenOrderIds = new Set<string>();

        payments.forEach(payment => {
            const methodName = payment.payment_method?.display_name || "อื่นๆ";
            paymentMethodSales[methodName] = Math.round(((paymentMethodSales[methodName] || 0) + Number(payment.amount)) * 100) / 100;

            if (payment.order) {
                const type = payment.order.order_type;
                orderTypeSales[type] = Math.round(((orderTypeSales[type] || 0) + Number(payment.amount)) * 100) / 100;
            }

            if (!payment.order || seenOrderIds.has(payment.order.id)) return;
            seenOrderIds.add(payment.order.id);

            const items = payment.order.items || [];
            items.forEach(item => {
                if (isCancelledStatus(item.status)) return;

                const qty = Number(item.quantity);
                const cost = Number(item.product?.cost || 0);
                const revenue = Number(item.total_price);

                totalCost += cost * qty;

                const catName = item.product?.category?.display_name || "อื่นๆ";
                categoryCounts[catName] = (categoryCounts[catName] || 0) + qty;

                const pId = item.product?.id;
                if (pId) {
                    if (!productSales[pId]) {
                        productSales[pId] = {
                            id: pId,
                            name: item.product.display_name,
                            quantity: 0,
                            revenue: 0,
                            unit: item.product.unit?.display_name || "ชิ้น"
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
    }

    async getShiftHistory(options: {
        branchId: string;
        page?: number;
        limit?: number;
        q?: string;
        status?: ShiftStatus;
        dateFrom?: Date;
        dateTo?: Date;
    }) {
        const {
            branchId,
            page = 1,
            limit = 20,
            q,
            status,
            dateFrom,
            dateTo
        } = options;

        const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 20;

        const applyFilters = <T extends SelectQueryBuilder<Shifts>>(qb: T) => {
            qb.where("shift.branch_id = :branchId", { branchId });

            if (status) {
                qb.andWhere("shift.status = :status", { status });
            }

            const keyword = q?.trim();
            if (keyword) {
                qb.andWhere(
                    "(CAST(shift.id AS text) ILIKE :q OR user.username ILIKE :q OR user.name ILIKE :q)",
                    { q: `%${keyword}%` }
                );
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

        const [rows, total] = await historyQuery
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
                openStatus: ShiftStatus.OPEN,
                closedStatus: ShiftStatus.CLOSED
            });
        applyFilters(statsQuery);

        const statsRaw = await statsQuery.getRawOne<{
            total_count: string | number | null;
            open_count: string | number | null;
            closed_count: string | number | null;
            total_start_amount: string | number | null;
            total_end_amount: string | number | null;
            total_expected_amount: string | number | null;
            total_diff_amount: string | number | null;
        }>();

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
                total: Number(statsRaw?.total_count || 0),
                open: Number(statsRaw?.open_count || 0),
                closed: Number(statsRaw?.closed_count || 0),
                total_start_amount: Number(statsRaw?.total_start_amount || 0),
                total_end_amount: Number(statsRaw?.total_end_amount || 0),
                total_expected_amount: Number(statsRaw?.total_expected_amount || 0),
                total_diff_amount: Number(statsRaw?.total_diff_amount || 0)
            }
        };
    }
}
