import { OrdersModels } from "../../models/pos/orders.model";
import { SocketService } from "../socket.service";
import { Orders } from "../../entity/pos/Orders";
import { AppDataSource } from "../../database/database";
import { Tables, TableStatus } from "../../entity/pos/Tables";
import { OrdersItem } from "../../entity/pos/OrdersItem";
import { OrderStatus } from "../../entity/pos/OrderEnums";

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
        try {
            if (!orders.order_no) {
                throw new Error("กรุณาระบุเลขที่ออเดอร์")
            }

            const existingOrder = await this.ordersModel.findOneByOrderNo(orders.order_no)
            if (existingOrder) {
                throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว")
            }

            const createdOrder = await this.ordersModel.create(orders)
            this.socketService.emit('orders:create', createdOrder)

            // Update Table Status if DineIn
            if (createdOrder.table_id) {
                const tablesRepo = AppDataSource.getRepository(Tables)
                await tablesRepo.update(createdOrder.table_id, { status: TableStatus.Unavailable })
                const updatedTable = await tablesRepo.findOneBy({ id: createdOrder.table_id })
                if (updatedTable) {
                    this.socketService.emit('tables:update', updatedTable)
                }
            }

            return createdOrder
        } catch (error) {
            throw error
        }
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

            // Check logic: If Served, check if all are served
            // REMOVED AUTO UPDATE as per user request (Manual Confirmation only)
            /*
            const itemRepo = AppDataSource.getRepository(OrdersItem);
            const item = await itemRepo.findOne({ where: { id: itemId } });

            if (item && item.order_id) {
                const orderId = item.order_id;
                const orderItems = await this.ordersModel.findItemsByOrderId(orderId);

                // Check if all items are Served or Cancelled
                const allServed = orderItems.every(i => i.status === OrderStatus.Served || i.status === OrderStatus.Cancelled);

                if (allServed) {
                    // Update Order Status to WaitingForPayment
                    await this.ordersModel.updateStatus(orderId, OrderStatus.WaitingForPayment);
                    // Update All Items to WaitingForPayment
                    await this.ordersModel.updateAllItemsStatus(orderId, OrderStatus.WaitingForPayment);

                    // Emit socket
                    const updatedOrder = await this.ordersModel.findOne(orderId);
                    if (updatedOrder) {
                        this.socketService.emit('orders:update', updatedOrder);
                    }
                }
            }
            */

        } catch (error) {
            throw error
        }
    }

    async addItem(orderId: string, itemData: any): Promise<Orders> {
        try {
            const item = new OrdersItem();
            item.order_id = orderId;
            item.product_id = itemData.product_id;
            item.quantity = itemData.quantity;
            item.price = itemData.price;
            item.discount_amount = itemData.discount_amount || 0;
            item.total_price = (item.price * item.quantity) - item.discount_amount; // Simple calc
            item.notes = itemData.notes;
            item.status = OrderStatus.Pending; // Default new item

            await this.ordersModel.createItem(item);

            // Recalculate
            await this.recalculateOrderTotal(orderId);

            const updatedOrder = await this.ordersModel.findOne(orderId);
            if (updatedOrder) this.socketService.emit('orders:update', updatedOrder);
            return updatedOrder!;
        } catch (error) {
            throw error;
        }
    }

    async updateItemDetails(itemId: string, data: { quantity?: number, notes?: string }): Promise<Orders> {
        try {
            const item = await this.ordersModel.findItemById(itemId);
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
            });

            await this.recalculateOrderTotal(item.order_id);

            const updatedOrder = await this.ordersModel.findOne(item.order_id);
            if (updatedOrder) this.socketService.emit('orders:update', updatedOrder);
            return updatedOrder!;
        } catch (error) {
            throw error;
        }
    }

    async deleteItem(itemId: string): Promise<Orders> {
        try {
            const item = await this.ordersModel.findItemById(itemId);
            if (!item) throw new Error("Item not found");
            const orderId = item.order_id;

            await this.ordersModel.deleteItem(itemId);

            await this.recalculateOrderTotal(orderId);

            const updatedOrder = await this.ordersModel.findOne(orderId);
            if (updatedOrder) this.socketService.emit('orders:update', updatedOrder);
            return updatedOrder!;
        } catch (error) {
            throw error;
        }
    }

    private async recalculateOrderTotal(orderId: string): Promise<void> {
        const items = await this.ordersModel.findItemsByOrderId(orderId);
        // exclude cancelled items from total? Yes usually.
        const validItems = items.filter(i => i.status !== OrderStatus.Cancelled);

        const subTotal = validItems.reduce((sum, item) => sum + Number(item.total_price), 0);
        // Assuming VAT is calc from subTotal or fixed logic. For now simple Update.
        // If discount exists on order, might need complex logic.

        const order = await this.ordersModel.findOne(orderId);
        if (!order) return;

        // Simple Update for now
        // TODO: Full Re-calc with VAT and Order Discount
        const total = subTotal; // + vat - discount

        await this.ordersModel.update(orderId, {
            sub_total: subTotal,
            total_amount: total // Simplification 
        } as Orders);
    }
}
