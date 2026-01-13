import { OrdersModels } from "../../models/pos/orders.model";
import { SocketService } from "../socket.service";
import { Orders } from "../../entity/pos/Orders";

export class OrdersService {
    private socketService = SocketService.getInstance();

    constructor(private ordersModel: OrdersModels) { }

    async findAll(): Promise<Orders[]> {
        try {
            return this.ordersModel.findAll()
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
            return createdOrder
        } catch (error) {
            throw error
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
