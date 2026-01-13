import { PaymentDetailsModels } from "../../models/pos/paymentDetails.model";
import { SocketService } from "../socket.service";
import { PaymentDetails } from "../../entity/pos/PaymentDetails";

export class PaymentDetailsService {
    private socketService = SocketService.getInstance();

    constructor(private paymentDetailsModel: PaymentDetailsModels) { }

    async findAll(): Promise<PaymentDetails[]> {
        try {
            return this.paymentDetailsModel.findAll()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<PaymentDetails | null> {
        try {
            return this.paymentDetailsModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async create(paymentDetails: PaymentDetails): Promise<PaymentDetails> {
        try {
            if (!paymentDetails.payment_id) {
                throw new Error("กรุณาระบุรหัสการชำระเงินหลัก")
            }

            const createdDetail = await this.paymentDetailsModel.create(paymentDetails)
            this.socketService.emit('paymentDetails:create', createdDetail)
            return createdDetail
        } catch (error) {
            throw error
        }
    }

    async update(id: string, paymentDetails: PaymentDetails): Promise<PaymentDetails> {
        try {
            const detailToUpdate = await this.paymentDetailsModel.findOne(id)
            if (!detailToUpdate) {
                throw new Error("ไม่พบข้อมูลรายละเอียดการชำระเงินที่ต้องการแก้ไข")
            }

            const updatedDetail = await this.paymentDetailsModel.update(id, paymentDetails)
            this.socketService.emit('paymentDetails:update', updatedDetail)
            return updatedDetail
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.paymentDetailsModel.delete(id)
            this.socketService.emit('paymentDetails:delete', { id })
        } catch (error) {
            throw error
        }
    }
}
