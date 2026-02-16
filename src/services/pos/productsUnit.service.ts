import { ProductsUnitModels } from "../../models/pos/productsUnit.model";
import { ProductsUnit } from "../../entity/pos/ProductsUnit";
import { AppError } from "../../utils/AppError";
import { CreatedSort } from "../../utils/sortCreated";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { SocketService } from "../socket.service";

export class ProductsUnitService {
    private socketService = SocketService.getInstance();

    constructor(private productsUnitModel: ProductsUnitModels) {}

    async findAll(branchId?: string, sortCreated: CreatedSort = "old"): Promise<ProductsUnit[]> {
        return this.productsUnitModel.findAll(branchId, sortCreated);
    }

    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive" },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: ProductsUnit[]; total: number; page: number; limit: number; last_page: number }> {
        return this.productsUnitModel.findAllPaginated(page, limit, filters, branchId, sortCreated);
    }

    async findOne(id: string, branchId?: string): Promise<ProductsUnit | null> {
        return this.productsUnitModel.findOne(id, branchId);
    }

    async findOneByName(unitName: string, branchId?: string): Promise<ProductsUnit | null> {
        return this.productsUnitModel.findOneByName(unitName, branchId);
    }

    async create(unit: ProductsUnit, branchId?: string): Promise<ProductsUnit> {
        const effectiveBranchId = branchId || unit.branch_id;
        if (effectiveBranchId) unit.branch_id = effectiveBranchId;

        const unitName = String(unit.unit_name || "").trim();
        const displayName = String(unit.display_name || "").trim();
        if (!unitName) throw AppError.badRequest("unit_name is required");
        if (!displayName) throw AppError.badRequest("display_name is required");
        unit.unit_name = unitName;
        unit.display_name = displayName;

        const dupByName = await this.productsUnitModel.findOneByName(unitName, effectiveBranchId);
        if (dupByName) throw AppError.conflict("unit_name already exists");

        const dupByDisplay = await this.productsUnitModel.findOneByDisplayName(displayName, effectiveBranchId);
        if (dupByDisplay) throw AppError.conflict("display_name already exists");

        const saved = await this.productsUnitModel.create(unit);
        const created = await this.productsUnitModel.findOne(saved.id, effectiveBranchId);
        if (created) {
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.productsUnit.create, created);
            }
            return created;
        }

        return saved;
    }

    async update(id: string, patch: ProductsUnit, branchId?: string): Promise<ProductsUnit> {
        const existing = await this.productsUnitModel.findOne(id, branchId);
        if (!existing) throw AppError.notFound("Products unit");

        const effectiveBranchId = branchId || existing.branch_id || patch.branch_id;
        if (effectiveBranchId) patch.branch_id = effectiveBranchId;

        if (patch.unit_name !== undefined) {
            const unitName = String(patch.unit_name || "").trim();
            if (!unitName) throw AppError.badRequest("unit_name is required");
            if (unitName !== existing.unit_name) {
                const dup = await this.productsUnitModel.findOneByName(unitName, effectiveBranchId);
                if (dup && dup.id !== id) throw AppError.conflict("unit_name already exists");
            }
            patch.unit_name = unitName;
        }

        if (patch.display_name !== undefined) {
            const displayName = String(patch.display_name || "").trim();
            if (!displayName) throw AppError.badRequest("display_name is required");
            if (displayName !== existing.display_name) {
                const dup = await this.productsUnitModel.findOneByDisplayName(displayName, effectiveBranchId);
                if (dup && dup.id !== id) throw AppError.conflict("display_name already exists");
            }
            patch.display_name = displayName;
        }

        const updated = await this.productsUnitModel.update(id, patch, effectiveBranchId);
        if (!updated) throw AppError.internal("Failed to update products unit");

        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.productsUnit.update, updated);
        }

        return updated;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.productsUnitModel.findOne(id, branchId);
        if (!existing) throw AppError.notFound("Products unit");

        const effectiveBranchId = branchId || existing.branch_id;
        await this.productsUnitModel.delete(id, effectiveBranchId);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.productsUnit.delete, { id });
        }
    }
}
