import { TablesModels } from "../../models/pos/tables.model";
import { SocketService } from "../socket.service";
import { Tables } from "../../entity/pos/Tables";
import { RealtimeEvents } from "../../utils/realtimeEvents";

export class TablesService {
    private socketService = SocketService.getInstance();

    constructor(private tablesModel: TablesModels) { }

    async findAll(page: number, limit: number, q?: string, branchId?: string): Promise<{ data: Tables[], total: number, page: number, last_page: number }> {
        try {
            return this.tablesModel.findAll(page, limit, q, branchId)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<Tables | null> {
        try {
            return this.tablesModel.findOne(id, branchId)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(table_name: string, branchId?: string): Promise<Tables | null> {
        try {
            return this.tablesModel.findOneByName(table_name, branchId)
        } catch (error) {
            throw error
        }
    }

    async create(tables: Tables): Promise<Tables> {
        try {
            if (!tables.table_name) {
                throw new Error("กรุณาระบุชื่อโต๊ะ")
            }

            const existingTable = await this.tablesModel.findOneByName(tables.table_name, tables.branch_id)
            if (existingTable) {
                throw new Error("ชื่อโต๊ะนี้มีอยู่ในระบบแล้ว")
            }

            const createdTable = await this.tablesModel.create(tables)
            if (createdTable.branch_id) {
                this.socketService.emitToBranch(createdTable.branch_id, RealtimeEvents.tables.create, createdTable)
            }
            return createdTable
        } catch (error) {
            throw error
        }
    }

    async update(id: string, tables: Tables, branchId?: string): Promise<Tables> {
        try {
            const tableToUpdate = await this.tablesModel.findOne(id, branchId)
            if (!tableToUpdate) {
                throw new Error("ไม่พบข้อมูลโต๊ะที่ต้องการแก้ไข")
            }

            if (tables.table_name && tables.table_name !== tableToUpdate.table_name) {
                const existingTable = await this.tablesModel.findOneByName(tables.table_name, tableToUpdate.branch_id)
                if (existingTable) {
                    throw new Error("ชื่อโต๊ะนี้มีอยู่ในระบบแล้ว")
                }
            }

            const effectiveBranchId = tableToUpdate.branch_id || branchId || tables.branch_id;
            const updatedTable = await this.tablesModel.update(id, tables, effectiveBranchId)
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.update, updatedTable)
            }
            return updatedTable
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const existing = await this.tablesModel.findOne(id, branchId);
            if (!existing) throw new Error("Table not found");
            await this.tablesModel.delete(id, branchId)
            const effectiveBranchId = existing.branch_id || branchId;
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.delete, { id })
            }
        } catch (error) {
            throw error
        }
    }
}
