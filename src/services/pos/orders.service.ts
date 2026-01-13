import { OrdersModels } from "../../models/pos/orders.model";
import { SocketService } from "../socket.service";
import { Orders } from "../../entity/pos/Orders";

export class OrdersService {
    private socketService = SocketService.getInstance();

    constructor(private ordersModel: OrdersModels) { }

    async findAll(page: number, limit: number): Promise<{ data: Orders[], total: number, page: number, limit: number }> {
        try {
            return this.ordersModel.findAll(page, limit)
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

            // Check if there are items to create transactionally
            // The controller might pass items in a separate property or we attach them to the 'orders' object?
            // Usually 'orders' entity object doesn't have 'items' populated on create unless we type cast.
            // For now, let's assume if 'items' exists in the input object (even if not in Entity type during strict checking, but here it's JS runtime).
            // Better approach: Method specific for full creation.

            // Standard create (Header only)
            const createdOrder = await this.ordersModel.create(orders)
            this.socketService.emit('orders:create', createdOrder)
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
}
