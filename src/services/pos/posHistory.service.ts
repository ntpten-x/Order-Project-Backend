import { PosHistoryModel } from "../../models/pos/posHistory.model";
import { PosHistory } from "../../entity/pos/PosHistory";

export class PosHistoryService {
    constructor(private posHistoryModel: PosHistoryModel) { }

    async findAll(page: number, limit: number): Promise<{ data: PosHistory[], total: number, page: number, limit: number }> {
        return this.posHistoryModel.findAll(page, limit);
    }

    async findOne(id: string): Promise<PosHistory | null> {
        return this.posHistoryModel.findOne(id);
    }

    async create(data: Partial<PosHistory>): Promise<PosHistory> {
        // Here you might add logic to format data or validate before saving
        return this.posHistoryModel.create(data);
    }

    async update(id: string, data: Partial<PosHistory>): Promise<PosHistory> {
        return this.posHistoryModel.update(id, data);
    }

    async delete(id: string): Promise<void> {
        return this.posHistoryModel.delete(id);
    }
}
