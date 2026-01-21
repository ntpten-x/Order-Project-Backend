import { SalesOrderDetailModels } from "../../models/pos/salesOrderDetail.model";
import { SocketService } from "../socket.service";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";

export class SalesOrderDetailService {
    private socketService = SocketService.getInstance();

    constructor(private salesOrderDetailModel: SalesOrderDetailModels) { }

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
                throw new Error("กรุณาระบุรหัสรายการสินค้าแม่ข่าย")
            }

            const createdDetail = await this.salesOrderDetailModel.create(salesOrderDetail)

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
                throw new Error("ไม่พบข้อมูลรายละเอียดเพิ่มเติมที่ต้องการแก้ไข")
            }

            const updatedDetail = await this.salesOrderDetailModel.update(id, salesOrderDetail)
            this.socketService.emit('salesOrderDetail:update', updatedDetail)
            return updatedDetail
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.salesOrderDetailModel.delete(id)
            this.socketService.emit('salesOrderDetail:delete', { id })
        } catch (error) {
            throw error
        }
    }
}
