import { OrdersModels } from "../../models/pos/orders.model";
import { SocketService } from "../socket.service";
import { Orders } from "../../entity/pos/Orders";
import { AppDataSource } from "../../database/database";
import { Tables, TableStatus } from "../../entity/pos/Tables";
import { OrdersItem } from "../../entity/pos/OrdersItem";
import { OrderStatus } from "../../entity/pos/OrderEnums";
import { EntityManager } from "typeorm";
import { PriceCalculatorService } from "./priceCalculator.service";

export class OrdersService {
    private socketService = SocketService.getInstance();

    constructor(private ordersModel: OrdersModels) { }

    async findAll(page: number, limit: number, statuses?: string[]): Promise<{ data: Orders[], total: number, page: number, limit: number }> {
        try {
            return this.ordersModel.findAll(page, limit, statuses)
        } catch (error) {
            throw error
        }
    }

    async findAllItems(status?: string): Promise<any[]> {
        try {
            return this.ordersModel.findAllItems(status)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Orders | null> {
        try {
            return this.ordersModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async create(orders: Orders): Promise<Orders> {
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

                // Emitting socket inside transaction is risky if tx fails later, but here it's fine as we are near end.
                // Ideally, emit AFTER tx commit.
                // But for now, let's keep logic similar but in tx.

                // Update Table Status if DineIn
                if (createdOrder.table_id) {
                    const tablesRepo = manager.getRepository(Tables)
                    await tablesRepo.update(createdOrder.table_id, { status: TableStatus.Unavailable })
                    const updatedTable = await tablesRepo.findOneBy({ id: createdOrder.table_id })
                    /* 
                       Note: Socket emission is side-effect. If tx causes rollback, UI might have received update.
                       Correct way is to return data and emit in controller, or use 'afterTransaction' hook.
                       For this refactor, I will emit AFTER the transaction block returns.
                    */
                }
                return createdOrder;
            } catch (error) {
                throw error
            }
        }).then((createdOrder) => {
            // Post-transaction Side Effects
            this.socketService.emit('orders:create', createdOrder)
            if (createdOrder.table_id) {
                // We need to fetch table to emit? Or just trust it updated.
                // Let's just re-fetch light or emit structure.
                // Actually, reading from DB here is safe as tx committed.
                const tablesRepo = AppDataSource.getRepository(Tables)
                tablesRepo.findOneBy({ id: createdOrder.table_id }).then(t => {
                    if (t) this.socketService.emit('tables:update', t)
                })
            }
            return createdOrder
        })
    }

    async createFullOrder(data: any): Promise<Orders> {
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

    async update(id: string, orders: Orders): Promise<Orders> {
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

    async addItem(orderId: string, itemData: any): Promise<Orders> {
        return await AppDataSource.transaction(async (manager) => {
            try {
                const item = new OrdersItem();
                item.order_id = orderId;
                item.product_id = itemData.product_id;
                item.quantity = itemData.quantity;
                item.price = itemData.price;
                item.discount_amount = itemData.discount_amount || 0;
                item.total_price = (item.price * item.quantity) - item.discount_amount;
                item.notes = itemData.notes;
                item.status = OrderStatus.Pending;

                await this.ordersModel.createItem(item, manager);

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

    async updateItemDetails(itemId: string, data: { quantity?: number, notes?: string }): Promise<Orders> {
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

    async deleteItem(itemId: string): Promise<Orders> {
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
        const repo = manager ? manager.getRepository(Orders) : AppDataSource.getRepository(Orders);

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
        } as Orders, manager);
    }
}
