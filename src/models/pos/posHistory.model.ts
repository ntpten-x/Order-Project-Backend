import { AppDataSource } from "../../database/database";
import { PosHistory } from "../../entity/pos/PosHistory";

export class PosHistoryModel {
    private posHistoryRepository = AppDataSource.getRepository(PosHistory);

    async findAll(page: number = 1, limit: number = 50): Promise<{ data: PosHistory[], total: number, page: number, limit: number }> {
        try {
            const skip = (page - 1) * limit;
            const [data, total] = await this.posHistoryRepository.findAndCount({
                order: {
                    create_date: "DESC"
                },
                take: limit,
                skip: skip
            });

            return {
                data,
                total,
                page,
                limit
            };
        } catch (error) {
            throw error;
        }
    }

    async findOne(id: string): Promise<PosHistory | null> {
        return this.posHistoryRepository.findOne({
            where: { id }
        });
    }

    async create(data: Partial<PosHistory>): Promise<PosHistory> {
        return this.posHistoryRepository.save(data);
    }

    async update(id: string, data: Partial<PosHistory>): Promise<PosHistory> {
        await this.posHistoryRepository.update(id, data);
        const updated = await this.findOne(id);
        if (!updated) {
            throw new Error("ไม่พบข้อมูลประวัติที่ต้องการแก้ไข");
        }
        return updated;
    }

    async delete(id: string): Promise<void> {
        await this.posHistoryRepository.delete(id);
    }
}
