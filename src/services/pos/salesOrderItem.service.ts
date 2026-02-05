import { SalesOrderItemModels } from "../../models/pos/salesOrderItem.model";
import { SocketService } from "../socket.service";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { getRepository } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";

export class SalesOrderItemService {
    private socketService = SocketService.getInstance();

    constructor(private salesOrderItemModel: SalesOrderItemModels) { }

    async findAll(branchId?: string): Promise<SalesOrderItem[]> {
        try {
            return this.salesOrderItemModel.findAll(branchId)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<SalesOrderItem | null> {
        try {
            return this.salesOrderItemModel.findOne(id, branchId)
        } catch (error) {
            throw error
        }
    }

    async create(salesOrderItem: SalesOrderItem, branchId?: string): Promise<SalesOrderItem> {
        try {
            if (!salesOrderItem.order_id) {
                throw new Error("กรุณาระบุรหัสออเดอร์")
            }
            if (!salesOrderItem.product_id) {
                throw new Error("กรุณาระบุรหัสสินค้า")
            }

            if (branchId) {
                const orderRepo = getRepository(SalesOrder);
                const order = await orderRepo.findOneBy({ id: salesOrderItem.order_id, branch_id: branchId } as any);
                if (!order) {
                    throw new Error("Order not found for this branch");
                }
            }

            const createdItem = await this.salesOrderItemModel.create(salesOrderItem)

            const completeItem = await this.salesOrderItemModel.findOne(createdItem.id, branchId)
            if (completeItem) {
                if (branchId) {
                    this.socketService.emitToBranch(branchId, RealtimeEvents.salesOrderItem.create, completeItem)
                }
                return completeItem
            }
            return createdItem
        } catch (error) {
            throw error
        }
    }

    async update(id: string, salesOrderItem: Partial<SalesOrderItem>, branchId?: string): Promise<SalesOrderItem> {
        try {
            const itemToUpdate = await this.salesOrderItemModel.findOne(id, branchId)
            if (!itemToUpdate) {
                throw new Error("ไม่พบข้อมูลรายการสินค้าในออเดอร์ที่ต้องการแก้ไข")
            }

            const updatedItem = await this.salesOrderItemModel.update(id, salesOrderItem, branchId)
            if (branchId) {
                this.socketService.emitToBranch(branchId, RealtimeEvents.salesOrderItem.update, updatedItem)
            }
            return updatedItem
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            await this.salesOrderItemModel.delete(id, branchId)
            if (branchId) {
                this.socketService.emitToBranch(branchId, RealtimeEvents.salesOrderItem.delete, { id })
            }
        } catch (error) {
            throw error
        }
    }
}
