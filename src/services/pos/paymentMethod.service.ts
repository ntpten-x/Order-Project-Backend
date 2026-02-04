import { PaymentMethodModels } from "../../models/pos/paymentMethod.model";
import { SocketService } from "../socket.service";
import { PaymentMethod } from "../../entity/pos/PaymentMethod";

export class PaymentMethodService {
    private socketService = SocketService.getInstance();

    constructor(private paymentMethodModel: PaymentMethodModels) { }

    async findAll(page: number, limit: number, q?: string, branchId?: string): Promise<{ data: PaymentMethod[], total: number, page: number, last_page: number }> {
        try {
            return this.paymentMethodModel.findAll(page, limit, q, branchId)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<PaymentMethod | null> {
        try {
            return this.paymentMethodModel.findOne(id, branchId)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(payment_method_name: string, branchId?: string): Promise<PaymentMethod | null> {
        try {
            return this.paymentMethodModel.findOneByName(payment_method_name, branchId)
        } catch (error) {
            throw error
        }
    }

    async create(paymentMethod: PaymentMethod, branchId?: string): Promise<PaymentMethod> {
        try {
            if (!paymentMethod.payment_method_name) {
                throw new Error("กรุณาระบุชื่อวิธีการชำระเงิน")
            }

            const effectiveBranchId = branchId || paymentMethod.branch_id;
            if (effectiveBranchId) {
                paymentMethod.branch_id = effectiveBranchId;
            }

            const existingPaymentMethod = await this.paymentMethodModel.findOneByName(paymentMethod.payment_method_name, effectiveBranchId)
            if (existingPaymentMethod) {
                throw new Error("ชื่อวิธีการชำระเงินนี้มีอยู่ในระบบแล้ว")
            }

            const createdPaymentMethod = await this.paymentMethodModel.create(paymentMethod)
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, 'paymentMethod:create', createdPaymentMethod)
            }
            return createdPaymentMethod
        } catch (error) {
            throw error
        }
    }

    async update(id: string, paymentMethod: PaymentMethod, branchId?: string): Promise<PaymentMethod> {
        try {
            const paymentMethodToUpdate = await this.paymentMethodModel.findOne(id, branchId)
            if (!paymentMethodToUpdate) {
                throw new Error("ไม่พบข้อมูลวิธีการชำระเงินที่ต้องการแก้ไข")
            }

            if (paymentMethod.payment_method_name && paymentMethod.payment_method_name !== paymentMethodToUpdate.payment_method_name) {
                const effectiveBranchId = branchId || paymentMethodToUpdate.branch_id || paymentMethod.branch_id;
                if (effectiveBranchId) {
                    paymentMethod.branch_id = effectiveBranchId;
                }
                const existingPaymentMethod = await this.paymentMethodModel.findOneByName(paymentMethod.payment_method_name, effectiveBranchId)
                if (existingPaymentMethod) {
                    throw new Error("ชื่อวิธีการชำระเงินนี้มีอยู่ในระบบแล้ว")
                }
            }

            const effectiveBranchId = branchId || paymentMethodToUpdate.branch_id || paymentMethod.branch_id;
            if (effectiveBranchId) {
                paymentMethod.branch_id = effectiveBranchId;
            }

            const updatedPaymentMethod = await this.paymentMethodModel.update(id, paymentMethod, effectiveBranchId)
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, 'paymentMethod:update', updatedPaymentMethod)
            }
            return updatedPaymentMethod
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const existing = await this.paymentMethodModel.findOne(id, branchId);
            if (!existing) throw new Error("Payment method not found");

            const effectiveBranchId = branchId || existing.branch_id;
            await this.paymentMethodModel.delete(id, effectiveBranchId)
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, 'paymentMethod:delete', { id })
            }
        } catch (error) {
            throw error
        }
    }
}
