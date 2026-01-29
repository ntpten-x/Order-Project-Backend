import { AppDataSource } from "../../database/database";
import { MoreThanOrEqual } from "typeorm";
import { Shifts, ShiftStatus } from "../../entity/pos/Shifts";
import { Payments } from "../../entity/pos/Payments";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { OrderStatus } from "../../entity/pos/OrderEnums";
import { AppError } from "../../utils/AppError";
import { SocketService } from "../socket.service";

export class ShiftsService {
    private shiftsRepo = AppDataSource.getRepository(Shifts);
    private paymentsRepo = AppDataSource.getRepository(Payments);
    private salesOrderItemRepo = AppDataSource.getRepository(SalesOrderItem);
    private salesOrderRepo = AppDataSource.getRepository(SalesOrder);
    private socketService = SocketService.getInstance();

    async openShift(userId: string, startAmount: number): Promise<Shifts> {
        // Check if user already has an OPEN shift
        const activeShift = await this.shiftsRepo.findOne({
            where: {
                user_id: userId,
                status: ShiftStatus.OPEN
            }
        });

        if (activeShift) {
            throw new AppError("ผู้ใช้งานนี้มีกะที่เปิดอยู่แล้ว กรุณาปิดกะก่อนเปิดใหม่", 400);
        }

        const newShift = new Shifts();
        newShift.user_id = userId;
        newShift.start_amount = isNaN(startAmount) ? 0 : startAmount;
        newShift.status = ShiftStatus.OPEN;
        newShift.open_time = new Date();

        const savedShift = await this.shiftsRepo.save(newShift);
        this.socketService.emit('shifts:update', savedShift);
        return savedShift;
    }

    async getCurrentShift(userId: string): Promise<Shifts | null> {
        return await this.shiftsRepo.findOne({
            where: {
                user_id: userId,
                status: ShiftStatus.OPEN
            }
        });
    }

    async closeShift(userId: string, endAmount: number): Promise<Shifts> {
        const activeShift = await this.getCurrentShift(userId);
        if (!activeShift) {
            throw new AppError("ไม่พบกะที่กำลังทำงานอยู่", 404);
        }

        // Check for pending/incomplete orders
        // Only check orders created during this shift
        const pendingOrders = await this.salesOrderRepo.count({
            where: [
                { status: OrderStatus.Pending, create_date: MoreThanOrEqual(activeShift.open_time) },
                { status: OrderStatus.Cooking, create_date: MoreThanOrEqual(activeShift.open_time) },
                { status: OrderStatus.Served, create_date: MoreThanOrEqual(activeShift.open_time) },
                { status: OrderStatus.WaitingForPayment, create_date: MoreThanOrEqual(activeShift.open_time) },
                { status: OrderStatus.pending, create_date: MoreThanOrEqual(activeShift.open_time) }
            ]
        });

        if (pendingOrders > 0) {
            throw new AppError(`ไม่สามารถปิดกะได้ เนื่องจากยังมีออเดอร์ค้างอยู่ในระบบจำนวน ${pendingOrders} รายการ กรุณาจัดการให้เรียบร้อย (เสร็จสิ้น หรือ ยกเลิก) ก่อนปิดกะ`, 400);
        }
        // Sum of all payments linked to this shift
        const payments = await this.paymentsRepo.find({
            where: { shift_id: activeShift.id }
        });

        const totalSales = Math.round(payments.reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100;

        // Expected Amount = Start + Sales
        // Note: In real world, we might subtract payouts/expenses. For now simple logic.
        const expectedAmount = Math.round((Number(activeShift.start_amount) + totalSales) * 100) / 100;

        activeShift.end_amount = endAmount;
        activeShift.expected_amount = expectedAmount;
        activeShift.diff_amount = Math.round((Number(endAmount) - expectedAmount) * 100) / 100;
        activeShift.status = ShiftStatus.CLOSED;
        activeShift.close_time = new Date();

        const savedShift = await this.shiftsRepo.save(activeShift);
        this.socketService.emit('shifts:update', savedShift);
        return savedShift;
    }

    async getShiftSummary(shiftId: string) {
        const shift = await this.shiftsRepo.findOne({
            where: { id: shiftId },
            relations: ["payments", "payments.payment_method", "payments.order", "payments.order.items", "payments.order.items.product", "payments.order.items.product.category", "payments.order.items.product.unit"]
        });

        if (!shift) {
            throw new AppError("ไม่พบข้อมูลกะ", 404);
        }

        const payments = shift.payments || [];

        // 1. Sales Calculation (only successful payments)
        const totalSales = Math.round(payments.reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100;

        // 2. Cost and Profit Calculation
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

        // Track seen orders to avoid double counting items
        const seenOrderIds = new Set<string>();

        payments.forEach(payment => {
            // Calculate sales by payment method
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
                if (item.status === 'Cancelled') return;

                const qty = Number(item.quantity);
                const cost = Number(item.product?.cost || 0);
                const revenue = Number(item.total_price);

                totalCost += cost * qty;

                // Category counts
                const catName = item.product?.category?.display_name || "อื่นๆ";
                categoryCounts[catName] = (categoryCounts[catName] || 0) + qty;

                // Product sales for top 5
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
    }
}
