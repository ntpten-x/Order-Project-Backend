import { AppDataSource } from "../../database/database";
import { Tables } from "../../entity/pos/Tables";

export class TablesModels {
    private tablesRepository = AppDataSource.getRepository(Tables)

    async findAll(): Promise<any[]> {
        try {
            return this.tablesRepository.createQueryBuilder("tables")
                .leftJoinAndMapOne("tables.active_order", "SalesOrder", "so", "so.table_id = tables.id AND so.status NOT IN (:...statuses)", { statuses: ['Paid', 'Cancelled', 'completed'] }) // Exclude 'completed' too just in case
                .orderBy("tables.create_date", "ASC")
                .getMany()
                .then(tables => tables.map((t: any) => {
                    const activeOrder = t.active_order;
                    return {
                        ...t,
                        status: activeOrder ? "Unavailable" : t.status, // Force Unavailable if active order exists
                        active_order_status: activeOrder?.status || null
                    };
                }));
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
