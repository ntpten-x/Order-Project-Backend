import { getRepository } from "../../database/dbContext";
import { PrintSettings } from "../../entity/pos/PrintSettings";
import { PrintSettingsPayload } from "../../utils/printSettings";

export class PrintSettingsModel {
    async findByBranchId(branchId: string): Promise<PrintSettings | null> {
        return getRepository(PrintSettings).findOne({
            where: { branch_id: branchId } as any,
        });
    }

    async createOrUpdate(branchId: string, payload: PrintSettingsPayload): Promise<PrintSettings> {
        const repo = getRepository(PrintSettings);
        const existing = await this.findByBranchId(branchId);

        if (existing) {
            await repo.update(existing.id, {
                branch_id: branchId,
                default_unit: payload.default_unit,
                locale: payload.locale,
                allow_manual_override: payload.allow_manual_override,
                documents: payload.documents,
                automation: payload.automation,
            });

            return repo.findOneBy({ id: existing.id }) as Promise<PrintSettings>;
        }

        const created = repo.create({
            branch_id: branchId,
            default_unit: payload.default_unit,
            locale: payload.locale,
            allow_manual_override: payload.allow_manual_override,
            documents: payload.documents,
            automation: payload.automation,
        });

        return repo.save(created);
    }
}

