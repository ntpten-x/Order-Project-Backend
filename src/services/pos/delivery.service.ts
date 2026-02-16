import { DeliveryModels } from "../../models/pos/delivery.model";
import { Delivery } from "../../entity/pos/Delivery";
import { CreatedSort } from "../../utils/sortCreated";
import { AppError } from "../../utils/AppError";
import { SocketService } from "../socket.service";
import { RealtimeEvents } from "../../utils/realtimeEvents";

export class DeliveryService {
    private socketService = SocketService.getInstance();

    constructor(private deliveryModel: DeliveryModels) { }

    async findAll(
        page: number,
        limit: number,
        q?: string,
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Delivery[]; total: number; page: number; last_page: number }> {
        return this.deliveryModel.findAll(page, limit, q, branchId, sortCreated);
    }

    async findOne(id: string, branchId?: string): Promise<Delivery | null> {
        return this.deliveryModel.findOne(id, branchId);
    }

    async findOneByName(delivery_name: string, branchId?: string): Promise<Delivery | null> {
        return this.deliveryModel.findOneByName(delivery_name, branchId);
    }

    async create(delivery: Delivery): Promise<Delivery> {
        const name = String(delivery.delivery_name || "").trim();
        if (!name) throw AppError.badRequest("delivery_name is required");
        delivery.delivery_name = name;

        const existing = await this.deliveryModel.findOneByName(name, delivery.branch_id);
        if (existing) throw AppError.conflict("Delivery name already exists");

        const created = await this.deliveryModel.create(delivery);
        if (created.branch_id) {
            this.socketService.emitToBranch(created.branch_id, RealtimeEvents.delivery.create, created);
        }
        return created;
    }

    async update(id: string, delivery: Delivery, branchId?: string): Promise<Delivery> {
        const existing = await this.deliveryModel.findOne(id, branchId);
        if (!existing) throw AppError.notFound("Delivery");

        if (delivery.delivery_name && String(delivery.delivery_name).trim() !== existing.delivery_name) {
            const nextName = String(delivery.delivery_name).trim();
            const conflict = await this.deliveryModel.findOneByName(nextName, existing.branch_id || branchId);
            if (conflict) throw AppError.conflict("Delivery name already exists");
            delivery.delivery_name = nextName;
        }

        const effectiveBranchId = existing.branch_id || branchId || delivery.branch_id;
        const updated = await this.deliveryModel.update(id, delivery, effectiveBranchId);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.delivery.update, updated);
        }
        return updated;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.deliveryModel.findOne(id, branchId);
        if (!existing) throw AppError.notFound("Delivery");

        await this.deliveryModel.delete(id, branchId);

        const effectiveBranchId = existing.branch_id || branchId;
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.delivery.delete, { id });
        }
    }
}
