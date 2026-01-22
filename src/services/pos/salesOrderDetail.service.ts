import { SalesOrderDetailModels } from "../../models/pos/salesOrderDetail.model";
import { SocketService } from "../socket.service";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { AppDataSource } from "../../database/database";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { recalculateOrderTotal } from "./orderTotals.service";

export class SalesOrderDetailService {
    private socketService = SocketService.getInstance();

    constructor(private salesOrderDetailModel: SalesOrderDetailModels) { }

    private async recalcByItemId(ordersItemId?: string | null): Promise<void> {
        if (!ordersItemId) return;
        const itemRepo = AppDataSource.getRepository(SalesOrderItem);
        const item = await itemRepo.findOneBy({ id: ordersItemId });
        if (item) {
            await recalculateOrderTotal(item.order_id);
        }
    }

    async findAll(): Promise<SalesOrderDetail[]> {
        try {
            return this.salesOrderDetailModel.findAll()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<SalesOrderDetail | null> {
        try {
            return this.salesOrderDetailModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async create(salesOrderDetail: SalesOrderDetail): Promise<SalesOrderDetail> {
        try {
            if (!salesOrderDetail.orders_item_id) {
                throw new Error("เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธเธฃเธซเธฑเธชเธฃเธฒเธขเธเธฒเธฃเธชเธดเธเธเนเธฒเนเธกเนเธเนเธฒเธข")
            }

            const createdDetail = await this.salesOrderDetailModel.create(salesOrderDetail)
            await this.recalcByItemId(createdDetail.orders_item_id);

            const completeDetail = await this.salesOrderDetailModel.findOne(createdDetail.id)
            if (completeDetail) {
                this.socketService.emit('salesOrderDetail:create', completeDetail)
                return completeDetail
            }
            return createdDetail
        } catch (error) {
            throw error
        }
    }

    async update(id: string, salesOrderDetail: SalesOrderDetail): Promise<SalesOrderDetail> {
        try {
            const detailToUpdate = await this.salesOrderDetailModel.findOne(id)
            if (!detailToUpdate) {
                throw new Error("ไม่พบรายละเอียดเพิ่มเติมที่ต้องการแก้ไข")
            }

            const updatedDetail = await this.salesOrderDetailModel.update(id, salesOrderDetail)
            await this.recalcByItemId(detailToUpdate.orders_item_id);
            this.socketService.emit('salesOrderDetail:update', updatedDetail)
            return updatedDetail
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            const detailToDelete = await this.salesOrderDetailModel.findOne(id)
            await this.salesOrderDetailModel.delete(id)
            await this.recalcByItemId(detailToDelete?.orders_item_id);
            this.socketService.emit('salesOrderDetail:delete', { id })
        } catch (error) {
            throw error
        }
    }
}
