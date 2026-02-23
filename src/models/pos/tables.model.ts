import { Tables } from "../../entity/pos/Tables";
import { getRepository } from "../../database/dbContext";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

export class TablesModels {
    async findAll(
        page: number = 1,
        limit: number = 50,
        q?: string,
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: any[], total: number, page: number, last_page: number }> {
        try {
            const skip = (page - 1) * limit;
            const tablesRepository = getRepository(Tables);
            const query = tablesRepository.createQueryBuilder("tables")
                // Support legacy 'completed'/'cancelled' statuses so tables don't stay stuck as Unavailable.
                .leftJoinAndMapOne(
                    "tables.active_order",
                    "SalesOrder",
                    "so",
                    "so.table_id = tables.id AND so.status NOT IN (:...statuses)",
                    { statuses: ["Paid", "Cancelled", "cancelled", "Completed", "completed"] },
                )
                .orderBy("tables.create_date", createdSortToOrder(sortCreated));

            if (q && q.trim()) {
                query.andWhere("tables.table_name ILIKE :q", { q: `%${q.trim()}%` });
            }

            if (branchId) {
                query.andWhere("tables.branch_id = :branchId", { branchId });
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

    async findOne(id: string, branchId?: string): Promise<Tables | null> {
        try {
            return getRepository(Tables).findOneBy(branchId ? ({ id, branch_id: branchId } as any) : { id })
        } catch (error) {
            throw error
        }
    }

    async findOneByName(table_name: string, branchId?: string): Promise<Tables | null> {
        try {
            const where: any = { table_name };
            if (branchId) where.branch_id = branchId;
            return getRepository(Tables).findOneBy(where)
        } catch (error) {
            throw error
        }
    }

    async create(data: Tables): Promise<Tables> {
        try {
            return getRepository(Tables).save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Tables, branchId?: string): Promise<Tables> {
        try {
            if (branchId) {
                await getRepository(Tables).update({ id, branch_id: branchId } as any, data)
            } else {
                await getRepository(Tables).update(id, data)
            }
            const updatedTable = await this.findOne(id, branchId)
            if (!updatedTable) {
                throw new Error("ไม่พบข้อมูลโต๊ะที่ต้องการค้นหา")
            }
            return updatedTable
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            if (branchId) {
                await getRepository(Tables).delete({ id, branch_id: branchId } as any)
            } else {
                await getRepository(Tables).delete(id)
            }
        } catch (error) {
            throw error
        }
    }
}
