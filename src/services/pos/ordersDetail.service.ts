import { OrdersDetailModels } from "../../models/pos/ordersDetail.model";
import { SocketService } from "../socket.service";
import { OrdersDetail } from "../../entity/pos/OrdersDetail";

export class OrdersDetailService {
    private socketService = SocketService.getInstance();

    constructor(private ordersDetailModel: OrdersDetailModels) { }

    async findAll(): Promise<OrdersDetail[]> {
        try {
            return this.ordersDetailModel.findAll()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<OrdersDetail | null> {
        try {
            return this.ordersDetailModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async create(ordersDetail: OrdersDetail): Promise<OrdersDetail> {
        try {
            if (!ordersDetail.orders_item_id) {
                throw new Error("กรุณาระบุรหัสรายการสินค้าแม่ข่าย")
            }

            const createdDetail = await this.ordersDetailModel.create(ordersDetail)

            const completeDetail = await this.ordersDetailModel.findOne(createdDetail.id)
            if (completeDetail) {
                this.socketService.emit('ordersDetail:create', completeDetail)
                return completeDetail
            }
            return createdDetail
        } catch (error) {
            throw error
        }
    }

    async update(id: string, ordersDetail: OrdersDetail): Promise<OrdersDetail> {
        try {
            const detailToUpdate = await this.ordersDetailModel.findOne(id)
            if (!detailToUpdate) {
                throw new Error("ไม่พบข้อมูลรายละเอียดเพิ่มเติมที่ต้องการแก้ไข")
            }

            const updatedDetail = await this.ordersDetailModel.update(id, ordersDetail)
            this.socketService.emit('ordersDetail:update', updatedDetail)
            return updatedDetail
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.ordersDetailModel.delete(id)
            this.socketService.emit('ordersDetail:delete', { id })
        } catch (error) {
            throw error
        }
    }
}
