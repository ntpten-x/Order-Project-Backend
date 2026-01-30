import { AppDataSource } from "../../database/database";
import { Tables } from "../../entity/pos/Tables";

export class TablesModels {
    private tablesRepository = AppDataSource.getRepository(Tables)

    async findAll(page: number = 1, limit: number = 50, q?: string): Promise<{ data: any[], total: number, page: number, last_page: number }> {
        try {
            const skip = (page - 1) * limit;
            const query = this.tablesRepository.createQueryBuilder("tables")
                .leftJoinAndMapOne("tables.active_order", "SalesOrder", "so", "so.table_id = tables.id AND so.status NOT IN (:...statuses)", { statuses: ['Paid', 'Cancelled', 'completed'] })
                .orderBy("tables.create_date", "ASC");

            if (q && q.trim()) {
                query.andWhere("tables.table_name ILIKE :q", { q: `%${q.trim()}%` });
            }

            const [rows, total] = await query.skip(skip).take(limit).getManyAndCount();

            const data = rows.map((t: any) => {
                const activeOrder = t.active_order;
                return {
                    ...t,
                    status: activeOrder ? "Unavailable" : t.status,
                    active_order_status: activeOrder?.status || null,
                    active_order_id: activeOrder?.id || null
                };
            });

            return {
                data,
                total,
                page,
                last_page: Math.max(1, Math.ceil(total / limit))
            };
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
