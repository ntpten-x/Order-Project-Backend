import { OrdersModels } from "../../models/pos/orders.model";
import { SocketService } from "../socket.service";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { AppDataSource } from "../../database/database";
import { Tables, TableStatus } from "../../entity/pos/Tables";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { OrderStatus } from "../../entity/pos/OrderEnums";
import { EntityManager } from "typeorm";
import { PriceCalculatorService } from "./priceCalculator.service";

export class OrdersService {
    private socketService = SocketService.getInstance();

    constructor(private ordersModel: OrdersModels) { }

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
                if (!orders.order_no) {
                    throw new Error("กรุณาระบุเลขที่ออเดอร์")
                }

                const existingOrder = await this.ordersModel.findOneByOrderNo(orders.order_no)
                if (existingOrder) {
                    throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว")
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
        try {
            if (!data.order_no) {
                throw new Error("กรุณาระบุเลขที่ออเดอร์")
            }

            const existingOrder = await this.ordersModel.findOneByOrderNo(data.order_no)
            if (existingOrder) {
                throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว")
            }

            // Separate items from order data
            const { items, ...orderData } = data;

            const createdOrder = await this.ordersModel.createFullOrder(orderData, items);

            // Fetch full data to emit
            const fullOrder = await this.ordersModel.findOne(createdOrder.id);
            if (fullOrder) {
                this.socketService.emit('orders:create', fullOrder);
                return fullOrder;
            }
            return createdOrder;

        } catch (error) {
            throw error;
        }
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

            const updatedOrder = await this.ordersModel.update(id, orders)
            this.socketService.emit('orders:update', updatedOrder)
            return updatedOrder
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.ordersModel.delete(id)
            this.socketService.emit('orders:delete', { id })
        } catch (error) {
            throw error
        }
    }

    async updateItemStatus(itemId: string, status: string): Promise<void> {
        try {
            await this.ordersModel.updateItemStatus(itemId, status)
        } catch (error) {
            throw error
        }
    }

    async addItem(orderId: string, itemData: any): Promise<SalesOrder> {
        return await AppDataSource.transaction(async (manager) => {
            try {
                const item = new SalesOrderItem();
                item.order_id = orderId;
                item.product_id = itemData.product_id;
                item.quantity = itemData.quantity;
                item.price = itemData.price;
                item.discount_amount = itemData.discount_amount || 0;
                const detailsTotal = itemData.details ? itemData.details.reduce((sum: number, d: any) => sum + (Number(d.extra_price) || 0), 0) : 0;
                item.total_price = (Number(item.price) + detailsTotal) * item.quantity - Number(item.discount_amount || 0);
                item.notes = itemData.notes;
                item.status = OrderStatus.Pending;

                const savedItem = await this.ordersModel.createItem(item, manager);

                if (itemData.details && itemData.details.length > 0) {
                    const detailRepo = manager.getRepository(SalesOrderDetail);
                    for (const d of itemData.details) {
                        const detail = new SalesOrderDetail();
                        detail.orders_item_id = savedItem.id;
                        detail.detail_name = d.detail_name;
                        detail.extra_price = d.extra_price || 0;
                        await detailRepo.save(detail);
                    }
                }

                await this.recalculateOrderTotal(orderId, manager);

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
                    item.quantity = data.quantity;
                    item.total_price = (Number(item.price) * item.quantity) - Number(item.discount_amount || 0);
                }
                if (data.notes !== undefined) {
                    item.notes = data.notes;
                }

                await this.ordersModel.updateItem(itemId, {
                    quantity: item.quantity,
                    total_price: item.total_price,
                    notes: item.notes
                }, manager);

                await this.recalculateOrderTotal(item.order_id, manager);

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

                await this.recalculateOrderTotal(orderId, manager);

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

    private async recalculateOrderTotal(orderId: string, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(SalesOrder) : AppDataSource.getRepository(SalesOrder);

        // Fetch order with discount relation
        const order = await repo.findOne({
            where: { id: orderId },
            relations: ["discount"]
        });

        if (!order) return;

        const items = await this.ordersModel.findItemsByOrderId(orderId, manager);
        // Exclude cancelled items from total
        const validItems = items.filter(i => i.status !== OrderStatus.Cancelled);

        // Calculate using Service
        const result = PriceCalculatorService.calculateOrderTotal(validItems, order.discount);

        // Update Order
        await this.ordersModel.update(orderId, {
            sub_total: result.subTotal,
            discount_amount: result.discountAmount,
            vat: result.vatAmount,
            total_amount: result.totalAmount
        } as SalesOrder, manager);
    }
}
