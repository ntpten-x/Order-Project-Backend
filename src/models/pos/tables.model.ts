import { AppDataSource } from "../../database/database";
import { Tables } from "../../entity/pos/Tables";

export class TablesModels {
    private tablesRepository = AppDataSource.getRepository(Tables)

    async findAll(): Promise<Tables[]> {
        try {
            return this.tablesRepository.find({
                order: {
                    create_date: "ASC"
                }
            })
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Tables | null> {
        try {
            return this.tablesRepository.findOneBy({ id })
        } catch (error) {
            throw error
        }
    }

    async findOneByName(table_name: string): Promise<Tables | null> {
        try {
            return this.tablesRepository.findOneBy({ table_name })
        } catch (error) {
            throw error
        }
    }

    async create(data: Tables): Promise<Tables> {
        try {
            return this.tablesRepository.save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Tables): Promise<Tables> {
        try {
            await this.tablesRepository.update(id, data)
            const updatedTable = await this.findOne(id)
            if (!updatedTable) {
                throw new Error("ไม่พบข้อมูลโต๊ะที่ต้องการค้นหา")
            }
            return updatedTable
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.tablesRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}
