import { Tables } from "../../entity/pos/Tables";
import { getRepository } from "../../database/dbContext";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

export class TablesModels {
    async findAll(
        page: number = 1,
        limit: number = 50,
        q?: string,
        branchId?: string,
        sortCreated: CreatedSort = "old",
        filters?: { status?: "active" | "inactive"; table_state?: "Available" | "Unavailable" }
    ): Promise<{ data: any[]; total: number; page: number; last_page: number }> {
        const skip = (page - 1) * limit;
        const tablesRepository = getRepository(Tables);
        const query = tablesRepository
            .createQueryBuilder("tables")
            // Keep legacy completed/cancelled values to avoid stuck table status.
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

        if (filters?.status === "active") {
            query.andWhere("tables.is_active = true");
        } else if (filters?.status === "inactive") {
            query.andWhere("tables.is_active = false");
        }

        if (filters?.table_state) {
            // Priority: if filtering by Available/Unavailable, we need to consider the active_order as well
            // However, the model logic handles 'status' mapping in the .map() phase.
            // For true DB filtering on 'Available', we need to check if an active order exists.
            if (filters.table_state === "Available") {
                query.andWhere("tables.status = 'Available'");
                // Also ensure no active order exists (legacy logic check)
                query.andWhere(qb => {
                    const subQuery = qb.subQuery()
                        .select("so.id")
                        .from("SalesOrder", "so")
                        .where("so.table_id = tables.id")
                        .andWhere("so.status NOT IN (:...soStatuses)", { soStatuses: ["Paid", "Cancelled", "cancelled", "Completed", "completed"] })
                        .getQuery();
                    return "NOT EXISTS " + subQuery;
                });
            } else if (filters.table_state === "Unavailable") {
                query.andWhere(qb => {
                    const subQuery = qb.subQuery()
                        .select("so.id")
                        .from("SalesOrder", "so")
                        .where("so.table_id = tables.id")
                        .andWhere("so.status NOT IN (:...soStatuses)", { soStatuses: ["Paid", "Cancelled", "cancelled", "Completed", "completed"] })
                        .getQuery();
                    return "(tables.status = 'Unavailable' OR EXISTS " + subQuery + ")";
                });
            }
        }

        const [rows, total] = await query.skip(skip).take(limit).getManyAndCount();

        const data = rows.map((t: any) => {
            const activeOrder = t.active_order;
            return {
                ...t,
                status: activeOrder ? "Unavailable" : t.status,
                active_order_status: activeOrder?.status || null,
                active_order_id: activeOrder?.id || null,
            };
        });

        return {
            data,
            total,
            page,
            last_page: Math.max(1, Math.ceil(total / limit)),
        };
    }

    async findOne(id: string, branchId?: string): Promise<Tables | null> {
        return getRepository(Tables).findOneBy(branchId ? ({ id, branch_id: branchId } as any) : { id });
    }

    async findOneByName(table_name: string, branchId?: string): Promise<Tables | null> {
        const where: any = { table_name };
        if (branchId) where.branch_id = branchId;
        return getRepository(Tables).findOneBy(where);
    }

    async findOneByQrToken(qrToken: string): Promise<Tables | null> {
        return getRepository(Tables)
            .createQueryBuilder("tables")
            .where("tables.qr_code_token = :qrToken", { qrToken })
            .getOne();
    }

    async findOneByQrTokenPublic(qrToken: string): Promise<Tables | null> {
        return getRepository(Tables)
            .createQueryBuilder("tables")
            .where("tables.qr_code_token = :qrToken", { qrToken })
            .andWhere("tables.is_active = true")
            .andWhere("(tables.qr_code_expires_at IS NULL OR tables.qr_code_expires_at > NOW())")
            .getOne();
    }

    async create(data: Tables): Promise<Tables> {
        return getRepository(Tables).save(data);
    }

    async update(id: string, data: Tables, branchId?: string): Promise<Tables> {
        if (branchId) {
            await getRepository(Tables).update({ id, branch_id: branchId } as any, data);
        } else {
            await getRepository(Tables).update(id, data);
        }
        const updatedTable = await this.findOne(id, branchId);
        if (!updatedTable) {
            throw new Error("Table not found after update");
        }
        return updatedTable;
    }

    async updateQrToken(
        id: string,
        qrToken: string,
        qrExpiresAt: Date | null,
        branchId?: string,
    ): Promise<Tables> {
        const qb = getRepository(Tables)
            .createQueryBuilder("tables")
            .update({ qr_code_token: qrToken, qr_code_expires_at: qrExpiresAt })
            .where("id = :id", { id });

        if (branchId) {
            qb.andWhere("branch_id = :branchId", { branchId });
        }

        await qb.execute();

        const updated = await this.findOne(id, branchId);
        if (!updated) {
            throw new Error("Table not found after QR token rotation");
        }

        return updated;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        if (branchId) {
            await getRepository(Tables).delete({ id, branch_id: branchId } as any);
        } else {
            await getRepository(Tables).delete(id);
        }
    }
}
