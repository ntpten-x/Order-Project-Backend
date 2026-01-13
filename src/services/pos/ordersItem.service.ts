import { OrdersItemModels } from "../../models/pos/ordersItem.model";
import { SocketService } from "../socket.service";
import { OrdersItem } from "../../entity/pos/OrdersItem";

export class OrdersItemService {
    private socketService = SocketService.getInstance();

    constructor(private ordersItemModel: OrdersItemModels) { }

    async findAll(): Promise<OrdersItem[]> {
        try {
            return this.ordersItemModel.findAll()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<OrdersItem | null> {
        try {
            return this.ordersItemModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async create(ordersItem: OrdersItem): Promise<OrdersItem> {
        try {
            if (!ordersItem.order_id) {
                throw new Error("กรุณาระบุรหัสออเดอร์")
            }
            if (!ordersItem.product_id) {
                throw new Error("กรุณาระบุรหัสสินค้า")
            }

            const createdItem = await this.ordersItemModel.create(ordersItem)

            const completeItem = await this.ordersItemModel.findOne(createdItem.id)
            if (completeItem) {
                this.socketService.emit('ordersItem:create', completeItem)
                return completeItem
            }
            return createdItem
        } catch (error) {
            throw error
        }
    }

    async update(id: string, ordersItem: OrdersItem): Promise<OrdersItem> {
        try {
            const itemToUpdate = await this.ordersItemModel.findOne(id)
            if (!itemToUpdate) {
                throw new Error("ไม่พบข้อมูลรายการสินค้าในออเดอร์ที่ต้องการแก้ไข")
            }

            const updatedItem = await this.ordersItemModel.update(id, ordersItem)
            this.socketService.emit('ordersItem:update', updatedItem)
            return updatedItem
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.ordersItemModel.delete(id)
            this.socketService.emit('ordersItem:delete', { id })
        } catch (error) {
            throw error
        }
    }
}
