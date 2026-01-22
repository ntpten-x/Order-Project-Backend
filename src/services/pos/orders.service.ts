import { OrdersModels } from "../../models/pos/orders.model";
import { SocketService } from "../socket.service";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { AppDataSource } from "../../database/database";
import { Tables, TableStatus } from "../../entity/pos/Tables";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { OrderStatus } from "../../entity/pos/OrderEnums";
import { Products } from "../../entity/pos/Products";
import { EntityManager } from "typeorm";
import { recalculateOrderTotal } from "./orderTotals.service";
import { AppError } from "../../utils/AppError";

export class OrdersService {
    private socketService = SocketService.getInstance();

    constructor(private ordersModel: OrdersModels) { }

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
        const prepared: Array<{ item: SalesOrderItem; details: SalesOrderDetail[] }> = [];

        for (const itemData of items) {
            if (!itemData?.product_id) {
                throw new AppError("Missing product_id", 400);
            }
            const product = await productRepo.findOne({
                where: { id: itemData.product_id, is_active: true }
            });
            if (!product) {
                throw new AppError("Product not found or inactive", 404);
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
            item.status = OrderStatus.Pending;

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

    async findAll(page: number, limit: number, statuses?: string[]): Promise<{ data: SalesOrder[], total: number, page: number, limit: number }> {
        try {
            return this.ordersModel.findAll(page, limit, statuses)
        } catch (error) {
            throw error
        }
    }

    async getStats(): Promise<{ dineIn: number, takeaway: number, delivery: number, total: number }> {
        try {
            // Active statuses: Pending, Cooking, Served, WaitingForPayment
            const activeStatuses = [
                OrderStatus.Pending,
                OrderStatus.Cooking,
                OrderStatus.Served,
                OrderStatus.WaitingForPayment
            ];
            return await this.ordersModel.getStats(activeStatuses);
        } catch (error) {
            throw error;
        }
    }

    async findAllItems(status?: string): Promise<any[]> {
        try {
            return this.ordersModel.findAllItems(status)
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
        }).then((createdOrder) => {
            // Post-transaction Side Effects
            this.socketService.emit('orders:create', createdOrder)
            if (createdOrder.table_id) {
                const tablesRepo = AppDataSource.getRepository(Tables)
                tablesRepo.findOneBy({ id: createdOrder.table_id }).then(t => {
                    if (t) this.socketService.emit('tables:update', t)
                })
            }
            return createdOrder
        })
    }

    async createFullOrder(data: any): Promise<SalesOrder> {
        return await AppDataSource.transaction(async (manager) => {
            const { items, ...orderData } = data;

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
            if ((finalStatus === OrderStatus.Paid || finalStatus === OrderStatus.Cancelled) && result.table_id) {
                const tablesRepo = AppDataSource.getRepository(Tables);
                await tablesRepo.update(result.table_id, { status: TableStatus.Available });
                const t = await tablesRepo.findOneBy({ id: result.table_id });
                if (t) this.socketService.emit('tables:update', t);
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

    async updateItemDetails(itemId: string, data: { quantity?: number, notes?: string }): Promise<SalesOrder> {
        return await AppDataSource.transaction(async (manager) => {
            try {
                const item = await this.ordersModel.findItemById(itemId, manager);
                if (!item) throw new Error("Item not found");

                if (data.quantity !== undefined) {
                    const qty = Number(data.quantity);
                    if (!Number.isFinite(qty) || qty <= 0) {
                        throw new AppError("Invalid quantity", 400);
                    }
                    item.quantity = qty;
                }
                if (data.notes !== undefined) {
                    item.notes = data.notes;
                }

                const detailsTotal = item.details ? item.details.reduce((sum: number, d: any) => sum + (Number(d.extra_price) || 0), 0) : 0;
                item.total_price = Math.max(0, (Number(item.price) + detailsTotal) * item.quantity - Number(item.discount_amount || 0));

                await this.ordersModel.updateItem(itemId, {
                    quantity: item.quantity,
                    total_price: item.total_price,
                    notes: item.notes
                }, manager);

                await recalculateOrderTotal(item.order_id, manager);

                const updatedOrder = await this.ordersModel.findOne(item.order_id);
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
