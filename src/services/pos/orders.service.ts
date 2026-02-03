import { OrdersModels } from "../../models/pos/orders.model";
import { SocketService } from "../socket.service";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { AppDataSource } from "../../database/database";
import { Tables, TableStatus } from "../../entity/pos/Tables";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { OrderStatus } from "../../entity/pos/OrderEnums";
import { Products } from "../../entity/pos/Products";
import { EntityManager, In } from "typeorm";
import { recalculateOrderTotal } from "./orderTotals.service";
import { AppError } from "../../utils/AppError";
import { ShiftsService } from "./shifts.service";
import { OrderQueueService } from "./orderQueue.service";
import { QueuePriority, QueueStatus, OrderQueue } from "../../entity/pos/OrderQueue";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";

export class OrdersService {
    private socketService = SocketService.getInstance();
    private shiftsService = new ShiftsService();
    private queueService = new OrderQueueService();

    constructor(private ordersModel: OrdersModels) { }

    private async ensureActiveShift(userId: string): Promise<void> {
        const activeShift = await this.shiftsService.getCurrentShift(userId);
        if (!activeShift) {
            throw new AppError("กรุณาเปิดกะก่อนทำรายการ (Active Shift Required)", 400);
        }
    }

    private async ensureOrderNo(orderNo?: string): Promise<string> {
        if (orderNo) return orderNo;
        for (let i = 0; i < 5; i++) {
            const now = new Date();
            const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
            const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "");
            const rand = Math.floor(1000 + Math.random() * 9000);
            const candidate = `ORD-${datePart}-${timePart}-${rand}`;
            const existing = await this.ordersModel.findOneByOrderNo(candidate);
            if (!existing) return candidate;
        }
        throw new AppError("Unable to generate order number", 500);
    }

    private async prepareItems(items: any[], manager: EntityManager): Promise<Array<{ item: SalesOrderItem; details: SalesOrderDetail[] }>> {
        const productRepo = manager.getRepository(Products);

        // 1. Collect all product IDs
        const productIds = items
            .map(i => i.product_id)
            .filter((id): id is string => !!id);

        if (productIds.length === 0) {
            throw new AppError("ไม่มีรายการสินค้าในคำสั่งซื้อ", 400);
        }

        // 2. Optimization: Batch Fetch Products (Single Query)
        // Instead of querying N times inside the loop
        const products = await productRepo.findBy({
            id: In(productIds),
            is_active: true
        });

        // 3. Create Map for O(1) Lookup
        const productMap = new Map(products.map(p => [p.id, p]));

        const prepared: Array<{ item: SalesOrderItem; details: SalesOrderDetail[] }> = [];

        for (const itemData of items) {
            if (!itemData?.product_id) {
                throw new AppError("Missing product_id", 400);
            }

            // Lookup from memory instead of DB
            const product = productMap.get(itemData.product_id);

            if (!product) {
                throw new AppError(`Product not found or inactive`, 404);
            }

            const quantity = Number(itemData.quantity);
            if (!Number.isFinite(quantity) || quantity <= 0) {
                throw new AppError("Invalid quantity", 400);
            }

            const discount = Number(itemData.discount_amount || 0);
            if (discount < 0) {
                throw new AppError("Invalid discount amount", 400);
            }

            const detailsData = Array.isArray(itemData.details) ? itemData.details : [];
            const detailsTotal = detailsData.reduce((sum: number, d: any) => sum + (Number(d?.extra_price) || 0), 0);

            const unitPrice = Number(product.price);
            const lineTotal = (unitPrice + detailsTotal) * quantity - discount;

            const item = new SalesOrderItem();
            item.product_id = product.id;
            item.quantity = quantity;
            item.price = unitPrice;
            item.discount_amount = discount;
            item.total_price = Math.max(0, Number(lineTotal));
            item.notes = itemData.notes;
            item.status = itemData.status || OrderStatus.Pending;

            const details: SalesOrderDetail[] = detailsData.map((d: any) => {
                const detail = new SalesOrderDetail();
                detail.detail_name = d?.detail_name ?? "";
                detail.extra_price = Number(d?.extra_price || 0);
                return detail;
            });

            prepared.push({ item, details });
        }

        return prepared;
    }

    private ensureValidStatus(status: string): OrderStatus {
        if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
            throw new AppError("Invalid status", 400);
        }
        return status as OrderStatus;
    }

    async findAll(page: number, limit: number, statuses?: string[], type?: string, query?: string, branchId?: string): Promise<{ data: SalesOrder[], total: number, page: number, limit: number }> {
        try {
            return this.ordersModel.findAll(page, limit, statuses, type, query, branchId)
        } catch (error) {
            throw error
        }
    }

    async findAllSummary(page: number, limit: number, statuses?: string[], type?: string, query?: string, branchId?: string): Promise<{ data: any[], total: number, page: number, limit: number }> {
        try {
            return this.ordersModel.findAllSummary(page, limit, statuses, type, query, branchId);
        } catch (error) {
            throw error;
        }
    }

    async getStats(branchId?: string): Promise<{ dineIn: number, takeaway: number, delivery: number, total: number }> {
        try {
            const activeStatuses = [
                OrderStatus.Pending,
                OrderStatus.Cooking,
                OrderStatus.Served,
                OrderStatus.WaitingForPayment
            ];
            return await this.ordersModel.getStats(activeStatuses, branchId);
        } catch (error) {
            throw error;
        }
    }

    async findAllItems(status?: string, page: number = 1, limit: number = 100, branchId?: string): Promise<any[]> {
        try {
            return this.ordersModel.findAllItems(status, page, limit, branchId)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<SalesOrder | null> {
        try {
            return this.ordersModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async create(orders: SalesOrder): Promise<SalesOrder> {
        if (orders.created_by_id) {
            await this.ensureActiveShift(orders.created_by_id);
        }
        return await AppDataSource.transaction(async (manager) => {
            try {
                if (orders.order_no) {
                    const existingOrder = await this.ordersModel.findOneByOrderNo(orders.order_no)
                    if (existingOrder) {
                        throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว")
                    }
                } else {
                    orders.order_no = await this.ensureOrderNo();
                }

                // Pass manager to create which uses it for repository
                const createdOrder = await this.ordersModel.create(orders, manager)

                // Update Table Status if DineIn
                if (createdOrder.table_id) {
                    const tablesRepo = manager.getRepository(Tables)
                    await tablesRepo.update(createdOrder.table_id, { status: TableStatus.Unavailable })
                }
                return createdOrder;
            } catch (error) {
                throw error
            }
        }).then(async (createdOrder) => {
            // Post-transaction Side Effects
            this.socketService.emit('orders:create', createdOrder)
            if (createdOrder.table_id) {
                const tablesRepo = AppDataSource.getRepository(Tables)
                tablesRepo.findOneBy({ id: createdOrder.table_id }).then(t => {
                    if (t) this.socketService.emit('tables:update', t)
                })
            }

            // Auto-add to queue if order is pending
            if (createdOrder.status === OrderStatus.Pending) {
                try {
                    await this.queueService.addToQueue(
                        createdOrder.id,
                        QueuePriority.Normal,
                        createdOrder.branch_id
                    );
                } catch (error) {
                    // Log but don't fail if queue add fails (might already be in queue)
                    console.warn('Failed to add order to queue:', error);
                }
            }

            return createdOrder
        })
    }

    async createFullOrder(data: any): Promise<SalesOrder> {
        const { items, ...orderData } = data;
        if (orderData.created_by_id) {
            await this.ensureActiveShift(orderData.created_by_id);
        }
        return await AppDataSource.transaction(async (manager) => {

            if (!items || !Array.isArray(items) || items.length === 0) {
                throw new AppError("กรุณาระบุรายการสินค้า", 400);
            }

            if (orderData.order_no) {
                const existingOrder = await this.ordersModel.findOneByOrderNo(orderData.order_no)
                if (existingOrder) {
                    throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว")
                }
            } else {
                orderData.order_no = await this.ensureOrderNo();
            }

            if (!orderData.status) {
                orderData.status = OrderStatus.Pending;
            }

            const preparedItems = await this.prepareItems(items, manager);

            const orderRepo = manager.getRepository(SalesOrder);
            const itemRepo = manager.getRepository(SalesOrderItem);
            const detailRepo = manager.getRepository(SalesOrderDetail);

            const savedOrder = await orderRepo.save(orderData);

            if (savedOrder.table_id) {
                const tablesRepo = manager.getRepository(Tables)
                await tablesRepo.update(savedOrder.table_id, { status: TableStatus.Unavailable })
            }

            for (const prepared of preparedItems) {
                prepared.item.order_id = savedOrder.id;
                const savedItem = await itemRepo.save(prepared.item);

                if (prepared.details.length > 0) {
                    for (const detail of prepared.details) {
                        detail.orders_item_id = savedItem.id;
                        await detailRepo.save(detail);
                    }
                }
            }

            await recalculateOrderTotal(savedOrder.id, manager);
            return savedOrder;
        }).then(async (savedOrder) => {
            const fullOrder = await this.ordersModel.findOne(savedOrder.id);
            if (fullOrder) {
                this.socketService.emit('orders:create', fullOrder);
                if (fullOrder.table_id) {
                    const tablesRepo = AppDataSource.getRepository(Tables)
                    const t = await tablesRepo.findOneBy({ id: fullOrder.table_id })
                    if (t) this.socketService.emit('tables:update', t)
                }

                // Auto-add to queue if order is pending
                if (fullOrder.status === OrderStatus.Pending) {
                    try {
                        await this.queueService.addToQueue(
                            fullOrder.id,
                            QueuePriority.Normal,
                            fullOrder.branch_id
                        );
                    } catch (error) {
                        // Log but don't fail if queue add fails (might already be in queue)
                        console.warn('Failed to add order to queue:', error);
                    }
                }

                return fullOrder;
            }
            return savedOrder;
        })
    }

    async update(id: string, orders: SalesOrder): Promise<SalesOrder> {
        try {
            const orderToUpdate = await this.ordersModel.findOne(id)
            if (!orderToUpdate) {
                throw new Error("ไม่พบข้อมูลออเดอร์ที่ต้องการแก้ไข")
            }

            if (orders.order_no && orders.order_no !== orderToUpdate.order_no) {
                const existingOrder = await this.ordersModel.findOneByOrderNo(orders.order_no)
                if (existingOrder) {
                    throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว")
                }
            }

            if (orders.status) {
                this.ensureValidStatus(String(orders.status));
            }

            const updatedOrder = await this.ordersModel.update(id, orders)

            if (orders.status) {
                const normalizedStatus = this.ensureValidStatus(String(orders.status));
                if (normalizedStatus === OrderStatus.Cancelled) {
                    await this.ordersModel.updateAllItemsStatus(id, OrderStatus.Cancelled);
                }
            }

            await recalculateOrderTotal(id);

            const refreshedOrder = await this.ordersModel.findOne(id);
            const result = refreshedOrder ?? updatedOrder;

            const finalStatus = (orders.status as OrderStatus) ?? result.status;
            // Release table if Order is Completed or Cancelled
            if ((finalStatus === OrderStatus.Completed || finalStatus === OrderStatus.Cancelled) && result.table_id) {
                const tablesRepo = AppDataSource.getRepository(Tables);
                await tablesRepo.update(result.table_id, { status: TableStatus.Available });
                const t = await tablesRepo.findOneBy({ id: result.table_id });
                if (t) this.socketService.emit('tables:update', t);
            }

            // Update queue status based on order status
            try {
                const queueRepo = AppDataSource.getRepository(OrderQueue);
                const queueItem = await queueRepo.findOne({ where: { order_id: result.id } });

                if (queueItem) {
                    if (finalStatus === OrderStatus.Cooking) {
                        await this.queueService.updateStatus(queueItem.id, QueueStatus.Processing);
                    } else if (finalStatus === OrderStatus.Completed || finalStatus === OrderStatus.Cancelled) {
                        await this.queueService.updateStatus(queueItem.id, finalStatus === OrderStatus.Completed
                            ? QueueStatus.Completed
                            : QueueStatus.Cancelled);
                    }
                }
            } catch (error) {
                // Log but don't fail if queue update fails
                console.warn('Failed to update queue status:', error);
            }

            this.socketService.emit('orders:update', result)
            return result
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            const order = await this.ordersModel.findOne(id);
            if (order?.table_id) {
                const tablesRepo = AppDataSource.getRepository(Tables);
                await tablesRepo.update(order.table_id, { status: TableStatus.Available });
                const t = await tablesRepo.findOneBy({ id: order.table_id });
                if (t) this.socketService.emit('tables:update', t);
            }
            await this.ordersModel.delete(id)
            this.socketService.emit('orders:delete', { id })
        } catch (error) {
            throw error
        }
    }

    async updateItemStatus(itemId: string, status: string): Promise<void> {
        try {
            const normalized = this.ensureValidStatus(status);
            const item = await this.ordersModel.findItemById(itemId);
            if (!item) throw new AppError("Item not found", 404);

            await this.ordersModel.updateItemStatus(itemId, normalized)
            await recalculateOrderTotal(item.order_id);

            const updatedOrder = await this.ordersModel.findOne(item.order_id);
            if (updatedOrder) this.socketService.emit('orders:update', updatedOrder);
        } catch (error) {
            throw error
        }
    }

    async addItem(orderId: string, itemData: any): Promise<SalesOrder> {
        return await AppDataSource.transaction(async (manager) => {
            try {
                const orderRepo = manager.getRepository(SalesOrder);
                const order = await orderRepo.findOneBy({ id: orderId });
                if (!order) throw new AppError("Order not found", 404);

                const prepared = await this.prepareItems([itemData], manager);
                const { item, details } = prepared[0];
                item.order_id = orderId;

                const savedItem = await this.ordersModel.createItem(item, manager);

                if (details.length > 0) {
                    const detailRepo = manager.getRepository(SalesOrderDetail);
                    for (const detail of details) {
                        detail.orders_item_id = savedItem.id;
                        await detailRepo.save(detail);
                    }
                }

                await recalculateOrderTotal(orderId, manager);

                const updatedOrder = await this.ordersModel.findOne(orderId);
                return updatedOrder!;
            } catch (error) {
                throw error;
            }
        }).then((updatedOrder) => {
            if (updatedOrder) this.socketService.emit('orders:update', updatedOrder);
            return updatedOrder!;
        })
    }

    async updateItemDetails(itemId: string, data: { quantity?: number, notes?: string, details?: any[] }): Promise<SalesOrder> {
        return await AppDataSource.transaction(async (manager) => {
            try {
                const item = await this.ordersModel.findItemById(itemId, manager);
                if (!item) throw new Error("Item not found");

                const detailRepo = manager.getRepository(SalesOrderDetail);

                if (data.details !== undefined) {
                    // 1. Delete existing details
                    await detailRepo.delete({ orders_item_id: itemId });

                    // 2. Add new details
                    if (Array.isArray(data.details) && data.details.length > 0) {
                        for (const d of data.details) {
                            if (!d.detail_name && !d.extra_price) continue;
                            const detail = new SalesOrderDetail();
                            detail.orders_item_id = itemId;
                            detail.detail_name = d.detail_name || "";
                            detail.extra_price = Number(d.extra_price || 0);
                            await detailRepo.save(detail);
                        }
                    }
                }

                // Refetch item with new details to get total price right
                const updatedItemWithDetails = await this.ordersModel.findItemById(itemId, manager);
                if (!updatedItemWithDetails) throw new Error("Item not found after detail update");

                if (data.quantity !== undefined) {
                    const qty = Number(data.quantity);
                    if (!Number.isFinite(qty) || qty <= 0) {
                        throw new AppError("Invalid quantity", 400);
                    }
                    updatedItemWithDetails.quantity = qty;
                }

                if (data.notes !== undefined) {
                    updatedItemWithDetails.notes = data.notes;
                }

                const detailsTotal = updatedItemWithDetails.details ? updatedItemWithDetails.details.reduce((sum: number, d: any) => sum + (Number(d.extra_price) || 0), 0) : 0;
                updatedItemWithDetails.total_price = Math.max(0, (Number(updatedItemWithDetails.price) + detailsTotal) * updatedItemWithDetails.quantity - Number(updatedItemWithDetails.discount_amount || 0));

                await this.ordersModel.updateItem(itemId, {
                    quantity: updatedItemWithDetails.quantity,
                    total_price: updatedItemWithDetails.total_price,
                    notes: updatedItemWithDetails.notes
                }, manager);

                await recalculateOrderTotal(updatedItemWithDetails.order_id, manager);

                const updatedOrder = await this.ordersModel.findOne(updatedItemWithDetails.order_id);
                return updatedOrder!;
            } catch (error) {
                throw error;
            }
        }).then((updatedOrder) => {
            if (updatedOrder) this.socketService.emit('orders:update', updatedOrder);
            return updatedOrder!;
        })
    }

    async deleteItem(itemId: string): Promise<SalesOrder> {
        return await AppDataSource.transaction(async (manager) => {
            try {
                const item = await this.ordersModel.findItemById(itemId, manager);
                if (!item) throw new Error("Item not found");
                const orderId = item.order_id;

                await this.ordersModel.deleteItem(itemId, manager);

                await recalculateOrderTotal(orderId, manager);

                const updatedOrder = await this.ordersModel.findOne(orderId);
                return updatedOrder!;
            } catch (error) {
                throw error;
            }
        }).then((updatedOrder) => {
            if (updatedOrder) this.socketService.emit('orders:update', updatedOrder);
            return updatedOrder!;
        })
    }
}
