import { TablesModels } from "../../models/pos/tables.model";
import { SocketService } from "../socket.service";
import { Tables } from "../../entity/pos/Tables";

export class TablesService {
    private socketService = SocketService.getInstance();

    constructor(private tablesModel: TablesModels) { }

    async findAll(): Promise<Tables[]> {
        try {
            return this.tablesModel.findAll()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Tables | null> {
        try {
            return this.tablesModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(table_name: string): Promise<Tables | null> {
        try {
            return this.tablesModel.findOneByName(table_name)
        } catch (error) {
            throw error
        }
    }

    async create(tables: Tables): Promise<Tables> {
        try {
            if (!tables.table_name) {
                throw new Error("กรุณาระบุชื่อโต๊ะ")
            }

            const existingTable = await this.tablesModel.findOneByName(tables.table_name)
            if (existingTable) {
                throw new Error("ชื่อโต๊ะนี้มีอยู่ในระบบแล้ว")
            }

            const createdTable = await this.tablesModel.create(tables)
            this.socketService.emit('tables:create', createdTable)
            return createdTable
        } catch (error) {
            throw error
        }
    }

    async update(id: string, tables: Tables): Promise<Tables> {
        try {
            const tableToUpdate = await this.tablesModel.findOne(id)
            if (!tableToUpdate) {
                throw new Error("ไม่พบข้อมูลโต๊ะที่ต้องการแก้ไข")
            }

            if (tables.table_name && tables.table_name !== tableToUpdate.table_name) {
                const existingTable = await this.tablesModel.findOneByName(tables.table_name)
                if (existingTable) {
                    throw new Error("ชื่อโต๊ะนี้มีอยู่ในระบบแล้ว")
                }
            }

            const updatedTable = await this.tablesModel.update(id, tables)
            this.socketService.emit('tables:update', updatedTable)
            return updatedTable
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.tablesModel.delete(id)
            this.socketService.emit('tables:delete', { id })
        } catch (error) {
            throw error
        }
    }
}
