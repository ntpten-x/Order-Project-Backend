import { SalesOrderItemModels } from "../../models/pos/salesOrderItem.model";
import { SocketService } from "../socket.service";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";

export class SalesOrderItemService {
    private socketService = SocketService.getInstance();

    constructor(private salesOrderItemModel: SalesOrderItemModels) { }

    async findAll(): Promise<SalesOrderItem[]> {
        try {
            return this.salesOrderItemModel.findAll()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<SalesOrderItem | null> {
        try {
            return this.salesOrderItemModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async create(salesOrderItem: SalesOrderItem): Promise<SalesOrderItem> {
        try {
            if (!salesOrderItem.order_id) {
                throw new Error("กรุณาระบุรหัสออเดอร์")
            }
            if (!salesOrderItem.product_id) {
                throw new Error("กรุณาระบุรหัสสินค้า")
            }

            const createdItem = await this.salesOrderItemModel.create(salesOrderItem)

            const completeItem = await this.salesOrderItemModel.findOne(createdItem.id)
            if (completeItem) {
                this.socketService.emit('salesOrderItem:create', completeItem)
                return completeItem
            }
            return createdItem
        } catch (error) {
            throw error
        }
    }

    async update(id: string, salesOrderItem: Partial<SalesOrderItem>): Promise<SalesOrderItem> {
        try {
            const itemToUpdate = await this.salesOrderItemModel.findOne(id)
            if (!itemToUpdate) {
                throw new Error("ไม่พบข้อมูลรายการสินค้าในออเดอร์ที่ต้องการแก้ไข")
            }

            const updatedItem = await this.salesOrderItemModel.update(id, salesOrderItem)
            this.socketService.emit('salesOrderItem:update', updatedItem)
            return updatedItem
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.salesOrderItemModel.delete(id)
            this.socketService.emit('salesOrderItem:delete', { id })
        } catch (error) {
            throw error
        }
    }
}
