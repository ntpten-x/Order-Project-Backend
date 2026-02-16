import { DiscountsModels } from "../../models/pos/discounts.model";
import { Discounts } from "../../entity/pos/Discounts";
import { CreatedSort } from "../../utils/sortCreated";
import { AppError } from "../../utils/AppError";
import { SocketService } from "../socket.service";
import { RealtimeEvents } from "../../utils/realtimeEvents";

export class DiscountsService {
    private socketService = SocketService.getInstance();

    constructor(private discountsModel: DiscountsModels) { }

    async findAll(q?: string, branchId?: string, sortCreated: CreatedSort = "old"): Promise<Discounts[]> {
        return this.discountsModel.findAll(q, branchId, sortCreated);
    }

    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive"; type?: string },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Discounts[]; total: number; page: number; limit: number; last_page: number }> {
        return this.discountsModel.findAllPaginated(page, limit, filters, branchId, sortCreated);
    }

    async findOne(id: string, branchId?: string): Promise<Discounts | null> {
        return this.discountsModel.findOne(id, branchId);
    }

    async findOneByName(discount_name: string, branchId?: string): Promise<Discounts | null> {
        return this.discountsModel.findOneByName(discount_name, branchId);
    }

    async create(discounts: Discounts, branchId?: string): Promise<Discounts> {
        const name = String(discounts.discount_name || "").trim();
        const displayName = String(discounts.display_name || "").trim();
        if (!name) throw AppError.badRequest("discount_name is required");
        if (!displayName) throw AppError.badRequest("display_name is required");
        discounts.discount_name = name;
        discounts.display_name = displayName;

        const effectiveBranchId = branchId || discounts.branch_id;
        if (effectiveBranchId) {
            discounts.branch_id = effectiveBranchId;
        }

        const existingByName = await this.discountsModel.findOneByName(name, effectiveBranchId);
        if (existingByName) throw AppError.conflict("discount_name already exists");

        const existingByDisplayName = await this.discountsModel.findOneByDisplayName(displayName, effectiveBranchId);
        if (existingByDisplayName) throw AppError.conflict("display_name already exists");

        const created = await this.discountsModel.create(discounts);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.discounts.create, created);
        }
        return created;
    }

    async update(id: string, discounts: Discounts, branchId?: string): Promise<Discounts> {
        const existing = await this.discountsModel.findOne(id, branchId);
        if (!existing) throw AppError.notFound("Discount");

        const effectiveBranchId = branchId || existing.branch_id || discounts.branch_id;
        if (effectiveBranchId) {
            discounts.branch_id = effectiveBranchId;
        }

        if (discounts.discount_name && String(discounts.discount_name).trim() !== existing.discount_name) {
            const nextName = String(discounts.discount_name).trim();
            const conflict = await this.discountsModel.findOneByName(nextName, effectiveBranchId);
            if (conflict) throw AppError.conflict("discount_name already exists");
            discounts.discount_name = nextName;
        }

        if (discounts.display_name && String(discounts.display_name).trim() !== existing.display_name) {
            const nextDisplayName = String(discounts.display_name).trim();
            const conflict = await this.discountsModel.findOneByDisplayName(nextDisplayName, effectiveBranchId);
            if (conflict) throw AppError.conflict("display_name already exists");
            discounts.display_name = nextDisplayName;
        }

        const updated = await this.discountsModel.update(id, discounts, effectiveBranchId);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.discounts.update, updated);
        }
        return updated;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.discountsModel.findOne(id, branchId);
        if (!existing) throw AppError.notFound("Discount");

        const effectiveBranchId = branchId || existing.branch_id;
        await this.discountsModel.delete(id, effectiveBranchId);

        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.discounts.delete, { id });
        }
    }
}
