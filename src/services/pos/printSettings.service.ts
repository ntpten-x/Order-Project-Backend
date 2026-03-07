import { getRepository } from "../../database/dbContext";
import { Branch } from "../../entity/Branch";
import { PrintSettings } from "../../entity/pos/PrintSettings";
import { SocketService } from "../socket.service";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { AppError } from "../../utils/AppError";
import { cacheKey, invalidateCache, queryCache, withCache } from "../../utils/cache";
import {
    PrintSettingsPayload,
    createDefaultPrintSettingsPayload,
    mergePrintSettingsPayload,
} from "../../utils/printSettings";
import { PrintSettingsModel } from "../../models/pos/printSettings.model";

export class PrintSettingsService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = "print-settings";
    private readonly CACHE_TTL = Number(
        process.env.PRINT_SETTINGS_CACHE_TTL_MS || process.env.POS_MASTER_CACHE_TTL_MS || 30_000
    );

    constructor(private model: PrintSettingsModel) { }

    private getCacheKey(branchId: string): string {
        return cacheKey(this.CACHE_PREFIX, "branch", branchId, "single");
    }

    private invalidateSettingsCache(branchId: string): void {
        invalidateCache([this.getCacheKey(branchId)]);
    }

    private async ensureBranchExists(branchId: string): Promise<void> {
        const branch = await getRepository(Branch).findOne({
            where: { id: branchId } as any,
        });

        if (!branch) {
            throw AppError.badRequest("Invalid branch: branch not found.");
        }
    }

    private toComparablePayload(entity?: PrintSettings | null): string {
        return JSON.stringify(this.toPayload(entity));
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
        const key = this.getCacheKey(branchId);

        return withCache(
            key,
            async () => {
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
            },
            this.CACHE_TTL,
            queryCache as any
        );
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
            {
                ...payload,
                locale: payload.locale?.trim() || payload.locale,
            }
        );

        if (existing && this.toComparablePayload(existing) === JSON.stringify(normalized)) {
            return existing;
        }

        const saved = await this.model.createOrUpdate(branchId, normalized);
        this.invalidateSettingsCache(branchId);
        this.socketService.emitToBranch(branchId, RealtimeEvents.printSettings.update, saved);
        return saved;
    }
}
