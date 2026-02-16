import { TablesModels } from "../../models/pos/tables.model";
import { Tables } from "../../entity/pos/Tables";
import { CreatedSort } from "../../utils/sortCreated";
import { AppError } from "../../utils/AppError";
import { SocketService } from "../socket.service";
import { RealtimeEvents } from "../../utils/realtimeEvents";

export class TablesService {
    private socketService = SocketService.getInstance();

    constructor(private tablesModel: TablesModels) { }

    async findAll(
        page: number,
        limit: number,
        q?: string,
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Tables[]; total: number; page: number; last_page: number }> {
        return this.tablesModel.findAll(page, limit, q, branchId, sortCreated);
    }

    async findOne(id: string, branchId?: string): Promise<Tables | null> {
        return this.tablesModel.findOne(id, branchId);
    }

    async findOneByName(table_name: string, branchId?: string): Promise<Tables | null> {
        return this.tablesModel.findOneByName(table_name, branchId);
    }

    async create(tables: Tables): Promise<Tables> {
        const name = String(tables.table_name || "").trim();
        if (!name) throw AppError.badRequest("table_name is required");
        tables.table_name = name;

        const existing = await this.tablesModel.findOneByName(name, tables.branch_id);
        if (existing) throw AppError.conflict("Table name already exists");

        const created = await this.tablesModel.create(tables);
        if (created.branch_id) {
            this.socketService.emitToBranch(created.branch_id, RealtimeEvents.tables.create, created);
        }
        return created;
    }

    async update(id: string, tables: Tables, branchId?: string): Promise<Tables> {
        const existing = await this.tablesModel.findOne(id, branchId);
        if (!existing) throw AppError.notFound("Table");

        if (tables.table_name && String(tables.table_name).trim() !== existing.table_name) {
            const nextName = String(tables.table_name).trim();
            const conflict = await this.tablesModel.findOneByName(nextName, existing.branch_id || branchId);
            if (conflict) throw AppError.conflict("Table name already exists");
            tables.table_name = nextName;
        }

        const effectiveBranchId = existing.branch_id || branchId || tables.branch_id;
        const updated = await this.tablesModel.update(id, tables, effectiveBranchId);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.update, updated);
        }
        return updated;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.tablesModel.findOne(id, branchId);
        if (!existing) throw AppError.notFound("Table");

        await this.tablesModel.delete(id, branchId);

        const effectiveBranchId = existing.branch_id || branchId;
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.delete, { id });
        }
    }
}
