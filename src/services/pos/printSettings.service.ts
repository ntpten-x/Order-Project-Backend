import { getRepository } from "../../database/dbContext";
import { Branch } from "../../entity/Branch";
import { PrintSettings } from "../../entity/pos/PrintSettings";
import { SocketService } from "../socket.service";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { AppError } from "../../utils/AppError";
import {
    PrintSettingsPayload,
    createDefaultPrintSettingsPayload,
    mergePrintSettingsPayload,
} from "../../utils/printSettings";
import { PrintSettingsModel } from "../../models/pos/printSettings.model";

export class PrintSettingsService {
    private socketService = SocketService.getInstance();

    constructor(private model: PrintSettingsModel) { }

    private async ensureBranchExists(branchId: string): Promise<void> {
        const branch = await getRepository(Branch).findOne({
            where: { id: branchId } as any,
        });

        if (!branch) {
            throw AppError.badRequest("Invalid branch: branch not found.");
        }
    }

    private toPayload(entity?: PrintSettings | null): PrintSettingsPayload {
        return mergePrintSettingsPayload(
            entity
                ? {
                    default_unit: entity.default_unit,
                    locale: entity.locale,
                    allow_manual_override: entity.allow_manual_override,
                    automation: entity.automation,
                    documents: entity.documents,
                }
                : undefined,
            undefined
        );
    }

    async getSettings(branchId: string): Promise<PrintSettings> {
        await this.ensureBranchExists(branchId);

        const existing = await this.model.findByBranchId(branchId);
        if (!existing) {
            return this.model.createOrUpdate(branchId, createDefaultPrintSettingsPayload());
        }

        const normalized = this.toPayload(existing);
        const current = {
            default_unit: existing.default_unit,
            locale: existing.locale,
            allow_manual_override: existing.allow_manual_override,
            automation: existing.automation,
            documents: existing.documents,
        };

        if (JSON.stringify(normalized) !== JSON.stringify(current)) {
            return this.model.createOrUpdate(branchId, normalized);
        }

        return existing;
    }

    async updateSettings(
        branchId: string,
        payload: Partial<PrintSettingsPayload>
    ): Promise<PrintSettings> {
        await this.ensureBranchExists(branchId);

        const existing = await this.model.findByBranchId(branchId);
        const normalized = mergePrintSettingsPayload(
            existing
                ? {
                    default_unit: existing.default_unit,
                    locale: existing.locale,
                    allow_manual_override: existing.allow_manual_override,
                    automation: existing.automation,
                    documents: existing.documents,
                }
                : undefined,
            payload
        );

        const saved = await this.model.createOrUpdate(branchId, normalized);
        this.socketService.emitToBranch(branchId, RealtimeEvents.printSettings.update, saved);
        return saved;
    }
}

