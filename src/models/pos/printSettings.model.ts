import { getRepository } from "../../database/dbContext";
import { PrintSettings } from "../../entity/pos/PrintSettings";
import { PrintSettingsPayload } from "../../utils/printSettings";

export class PrintSettingsModel {
    private toPersistencePayload(branchId: string, payload: PrintSettingsPayload): Partial<PrintSettings> {
        return {
            branch_id: branchId,
            default_unit: payload.default_unit,
            locale: payload.locale,
            allow_manual_override: payload.allow_manual_override,
            documents: payload.documents,
            automation: payload.automation,
        };
    }

    async findByBranchId(branchId: string): Promise<PrintSettings | null> {
        return getRepository(PrintSettings).findOne({
            where: { branch_id: branchId } as any,
        });
    }

    async createOrUpdate(branchId: string, payload: PrintSettingsPayload): Promise<PrintSettings> {
        const repo = getRepository(PrintSettings);
        await repo.upsert(this.toPersistencePayload(branchId, payload), ["branch_id"]);
        return repo.findOneBy({ branch_id: branchId }) as Promise<PrintSettings>;
    }
}
