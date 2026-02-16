import { PaymentMethodModels } from "../../models/pos/paymentMethod.model";
import { SocketService } from "../socket.service";
import { PaymentMethod } from "../../entity/pos/PaymentMethod";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";
import { AppError } from "../../utils/AppError";

export class PaymentMethodService {
    private socketService = SocketService.getInstance();

    constructor(private paymentMethodModel: PaymentMethodModels) {}

    async findAll(
        page: number,
        limit: number,
        q?: string,
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: PaymentMethod[]; total: number; page: number; last_page: number }> {
        return this.paymentMethodModel.findAll(page, limit, q, branchId, sortCreated);
    }

    async findOne(id: string, branchId?: string): Promise<PaymentMethod | null> {
        return this.paymentMethodModel.findOne(id, branchId);
    }

    async findOneByName(payment_method_name: string, branchId?: string): Promise<PaymentMethod | null> {
        return this.paymentMethodModel.findOneByName(payment_method_name, branchId);
    }

    async create(paymentMethod: PaymentMethod, branchId?: string): Promise<PaymentMethod> {
        const effectiveBranchId = branchId || paymentMethod.branch_id;
        if (effectiveBranchId) paymentMethod.branch_id = effectiveBranchId;

        const methodName = String(paymentMethod.payment_method_name || "").trim();
        const displayName = String(paymentMethod.display_name || "").trim();
        if (!methodName) throw AppError.badRequest("payment_method_name is required");
        if (!displayName) throw AppError.badRequest("display_name is required");
        paymentMethod.payment_method_name = methodName;
        paymentMethod.display_name = displayName;

        const dupByName = await this.paymentMethodModel.findOneByName(methodName, effectiveBranchId);
        if (dupByName) throw AppError.conflict("payment_method_name already exists");

        const dupByDisplay = await this.paymentMethodModel.findOneByDisplayName(displayName, effectiveBranchId);
        if (dupByDisplay) throw AppError.conflict("display_name already exists");

        const created = await this.paymentMethodModel.create(paymentMethod);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.paymentMethods.create, created);
        }
        return created;
    }

    async update(id: string, paymentMethod: PaymentMethod, branchId?: string): Promise<PaymentMethod> {
        const existing = await this.paymentMethodModel.findOne(id, branchId);
        if (!existing) throw AppError.notFound("Payment method");

        const effectiveBranchId = branchId || existing.branch_id || paymentMethod.branch_id;
        if (effectiveBranchId) paymentMethod.branch_id = effectiveBranchId;

        if (paymentMethod.payment_method_name !== undefined) {
            const methodName = String(paymentMethod.payment_method_name || "").trim();
            if (!methodName) throw AppError.badRequest("payment_method_name is required");
            if (methodName !== existing.payment_method_name) {
                const dup = await this.paymentMethodModel.findOneByName(methodName, effectiveBranchId);
                if (dup && dup.id !== id) throw AppError.conflict("payment_method_name already exists");
            }
            paymentMethod.payment_method_name = methodName;
        }

        if (paymentMethod.display_name !== undefined) {
            const displayName = String(paymentMethod.display_name || "").trim();
            if (!displayName) throw AppError.badRequest("display_name is required");
            if (displayName !== existing.display_name) {
                const dup = await this.paymentMethodModel.findOneByDisplayName(displayName, effectiveBranchId);
                if (dup && dup.id !== id) throw AppError.conflict("display_name already exists");
            }
            paymentMethod.display_name = displayName;
        }

        const updated = await this.paymentMethodModel.update(id, paymentMethod, effectiveBranchId);
        if (!updated) throw AppError.internal("Failed to update payment method");

        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.paymentMethods.update, updated);
        }
        return updated;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.paymentMethodModel.findOne(id, branchId);
        if (!existing) throw AppError.notFound("Payment method");

        const effectiveBranchId = branchId || existing.branch_id;
        await this.paymentMethodModel.delete(id, effectiveBranchId);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.paymentMethods.delete, { id });
        }
    }
}
