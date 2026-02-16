import { SalesOrderDetailModels } from "../../models/pos/salesOrderDetail.model";
import { SocketService } from "../socket.service";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { recalculateOrderTotal } from "./orderTotals.service";
import { getRepository } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";

export class SalesOrderDetailService {
    private socketService = SocketService.getInstance();

    constructor(private salesOrderDetailModel: SalesOrderDetailModels) { }

    private async recalcByItemId(ordersItemId?: string | null): Promise<void> {
        if (!ordersItemId) return;
        const itemRepo = getRepository(SalesOrderItem);
        const item = await itemRepo.findOneBy({ id: ordersItemId });
        if (item) {
            await recalculateOrderTotal(item.order_id);
        }
    }

    async findAll(branchId?: string): Promise<SalesOrderDetail[]> {
        try {
            return this.salesOrderDetailModel.findAll(branchId)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<SalesOrderDetail | null> {
        try {
            return this.salesOrderDetailModel.findOne(id, branchId)
        } catch (error) {
            throw error
        }
    }

    async create(salesOrderDetail: SalesOrderDetail, branchId?: string): Promise<SalesOrderDetail> {
        try {
            if (!salesOrderDetail.orders_item_id) {
                throw new Error("กรุณาระบุรหัสรายการสินค้าแม่ข่าย")
            }

            if (branchId) {
                const itemRepo = getRepository(SalesOrderItem);
                const item = await itemRepo
                    .createQueryBuilder("item")
                    .innerJoin("item.order", "order")
                    .where("item.id = :id", { id: salesOrderDetail.orders_item_id })
                    .andWhere("order.branch_id = :branchId", { branchId })
                    .getOne();

                if (!item) {
                    throw new Error("Order item not found for this branch");
                }
            }

            const createdDetail = await this.salesOrderDetailModel.create(salesOrderDetail)
            await this.recalcByItemId(createdDetail.orders_item_id);

            const completeDetail = await this.salesOrderDetailModel.findOne(createdDetail.id, branchId)
            if (completeDetail) {
                if (branchId) {
                    this.socketService.emitToBranch(branchId, RealtimeEvents.salesOrderDetail.create, completeDetail)
                }
                return completeDetail
            }
            return createdDetail
        } catch (error) {
            throw error
        }
    }

    async update(id: string, salesOrderDetail: SalesOrderDetail, branchId?: string): Promise<SalesOrderDetail> {
        try {
            const detailToUpdate = await this.salesOrderDetailModel.findOne(id, branchId)
            if (!detailToUpdate) {
                throw new Error("ไม่พบรายละเอียดเพิ่มเติมที่ต้องการแก้ไข")
            }

            const updatedDetail = await this.salesOrderDetailModel.update(id, salesOrderDetail, branchId)
            await this.recalcByItemId(detailToUpdate.orders_item_id);
            if (branchId) {
                this.socketService.emitToBranch(branchId, RealtimeEvents.salesOrderDetail.update, updatedDetail)
            }
            return updatedDetail
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const detailToDelete = await this.salesOrderDetailModel.findOne(id, branchId)
            await this.salesOrderDetailModel.delete(id, branchId)
            await this.recalcByItemId(detailToDelete?.orders_item_id);
            if (branchId) {
                this.socketService.emitToBranch(branchId, RealtimeEvents.salesOrderDetail.delete, { id })
            }
        } catch (error) {
            throw error
        }
    }
}
