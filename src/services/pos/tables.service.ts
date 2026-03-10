import { randomBytes } from "crypto";
import { TablesModels } from "../../models/pos/tables.model";
import { SocketService } from "../socket.service";
import { Tables } from "../../entity/pos/Tables";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { getDbContext, getRepository } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";
import { AppError } from "../../utils/AppError";
import { cacheKey, invalidateCache, queryCache, withCache } from "../../utils/cache";
import { getTableCacheInvalidationPatterns } from "./tableCache.utils";
import { OrderSummarySnapshotService } from "./orderSummarySnapshot.service";
import { bumpOrderReadModelVersions, invalidateOrderReadCaches } from "./ordersReadCache.utils";

const QR_TOKEN_BYTES = Math.max(16, Number(process.env.TABLE_QR_TOKEN_BYTES || 24));
const QR_TOKEN_EXPIRE_DAYS = Number(process.env.TABLE_QR_TOKEN_EXPIRE_DAYS || 365);

type TableQrCodeListItem = Tables & {
    customer_path: string | null;
};

export class TablesService {
    private socketService = SocketService.getInstance();
    private orderSummarySnapshotService = new OrderSummarySnapshotService();
    private readonly CACHE_PREFIX = "tables";
    private readonly CACHE_TTL = Number(process.env.POS_MASTER_CACHE_TTL_MS || 30_000);

    constructor(private tablesModel: TablesModels) { }

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

    private getInvalidationPatterns(branchId?: string, id?: string): string[] {
        return getTableCacheInvalidationPatterns(branchId, id);
    }

    private invalidateTablesCache(branchId?: string, id?: string): void {
        invalidateCache(this.getInvalidationPatterns(branchId, id));
    }

    private async invalidateOrderReadModels(branchId?: string): Promise<void> {
        await bumpOrderReadModelVersions(branchId);
        invalidateOrderReadCaches(branchId);
    }

    async findAll(
        page: number,
        limit: number,
        q?: string,
        branchId?: string,
        sortCreated: CreatedSort = "old",
        filters?: { status?: "active" | "inactive"; table_state?: "Available" | "Unavailable" }
    ): Promise<{ data: Tables[]; total: number; page: number; last_page: number }> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(
            this.CACHE_PREFIX,
            ...scope,
            "list",
            page,
            limit,
            sortCreated,
            (q || "").trim().toLowerCase(),
            JSON.stringify(filters || {})
        );

        return withCache(
            key,
            () => this.tablesModel.findAll(page, limit, q, branchId, sortCreated, filters),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOne(id: string, branchId?: string): Promise<Tables | null> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "single", id);

        return withCache(
            key,
            () => this.tablesModel.findOne(id, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOneByName(table_name: string, branchId?: string): Promise<Tables | null> {
        const scope = this.getCacheScopeParts(branchId);
        const normalizedName = table_name.trim().toLowerCase();
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "name", normalizedName);

        return withCache(
            key,
            () => this.tablesModel.findOneByName(table_name, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    private isQrTokenExpired(expiresAt?: Date | string | null): boolean {
        if (!expiresAt) return false;
        const timestamp = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
        if (Number.isNaN(timestamp)) return true;
        return timestamp <= Date.now();
    }

    private buildQrToken(): string {
        return randomBytes(QR_TOKEN_BYTES).toString("base64url");
    }

    private resolveQrExpiryDate(): Date | null {
        if (!Number.isFinite(QR_TOKEN_EXPIRE_DAYS) || QR_TOKEN_EXPIRE_DAYS <= 0) {
            return null;
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + QR_TOKEN_EXPIRE_DAYS);
        return expiresAt;
    }

    private async generateUniqueQrToken(): Promise<string> {
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const token = this.buildQrToken();
            const existing = await this.tablesModel.findOneByQrToken(token);
            if (!existing) {
                return token;
            }
        }

        throw AppError.internal("Unable to generate unique table QR token");
    }

    async ensureQrToken(id: string, branchId?: string): Promise<Tables> {
        const table = await this.tablesModel.findOne(id, branchId);
        if (!table) {
            throw AppError.notFound("Table");
        }

        const isExpired =
            table.qr_code_expires_at instanceof Date
                ? table.qr_code_expires_at.getTime() <= Date.now()
                : table.qr_code_expires_at
                    ? new Date(table.qr_code_expires_at).getTime() <= Date.now()
                    : false;

        if (table.qr_code_token && !isExpired) {
            return table;
        }

        return this.rotateQrToken(id, branchId);
    }

    async findAllWithQrCodes(
        page: number,
        limit: number,
        q?: string,
        branchId?: string,
        sortCreated: CreatedSort = "old",
        filters?: { status?: "active" | "inactive"; table_state?: "Available" | "Unavailable" }
    ): Promise<{ data: TableQrCodeListItem[]; total: number; page: number; last_page: number }> {
        const result = await this.tablesModel.findAll(page, limit, q, branchId, sortCreated, filters);
        const data: TableQrCodeListItem[] = [];

        for (const rawTable of result.data) {
            const table = rawTable as Tables;
            let qrToken = table.qr_code_token ?? null;
            let qrExpiresAt = table.qr_code_expires_at ?? null;

            if (!qrToken || this.isQrTokenExpired(qrExpiresAt)) {
                const rotated = await this.rotateQrTokenInternal(table.id, branchId || table.branch_id, false);
                qrToken = rotated.qr_code_token ?? null;
                qrExpiresAt = rotated.qr_code_expires_at ?? null;
            }

            data.push({
                ...table,
                qr_code_token: qrToken,
                qr_code_expires_at: qrExpiresAt,
                customer_path: qrToken ? `/order/${qrToken}` : null,
            });
        }

        return {
            ...result,
            data,
        };
    }

    private async rotateQrTokenInternal(id: string, branchId?: string, emitRealtime: boolean = true): Promise<Tables> {
        const table = await this.tablesModel.findOne(id, branchId);
        if (!table) {
            throw AppError.notFound("Table");
        }

        const token = await this.generateUniqueQrToken();
        const expiresAt = this.resolveQrExpiryDate();

        const updated = await this.tablesModel.updateQrToken(id, token, expiresAt, branchId || table.branch_id);
        const effectiveBranchId = updated.branch_id || branchId;
        this.invalidateTablesCache(effectiveBranchId, id);
        if (emitRealtime && effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.update, updated);
        }
        return updated;
    }

    async rotateQrToken(id: string, branchId?: string): Promise<Tables> {
        return this.rotateQrTokenInternal(id, branchId, true);
    }

    async create(tables: Tables): Promise<Tables> {
        const tableName = tables.table_name?.trim();
        if (!tableName) {
            throw AppError.badRequest("Table name is required");
        }

        tables.table_name = tableName;
        const existingTable = await this.tablesModel.findOneByName(tableName, tables.branch_id);
        if (existingTable) {
            throw AppError.conflict("Table name already exists");
        }

        if (!tables.qr_code_token) {
            tables.qr_code_token = await this.generateUniqueQrToken();
        }

        if (tables.qr_code_expires_at === undefined) {
            tables.qr_code_expires_at = this.resolveQrExpiryDate();
        }

        const createdTable = await this.tablesModel.create(tables);
        this.invalidateTablesCache(createdTable.branch_id, createdTable.id);
        if (createdTable.branch_id) {
            this.socketService.emitToBranch(createdTable.branch_id, RealtimeEvents.tables.create, createdTable);
        }
        return createdTable;
    }

    async update(id: string, tables: Tables, branchId?: string): Promise<Tables> {
        const tableToUpdate = await this.tablesModel.findOne(id, branchId);
        if (!tableToUpdate) {
            throw AppError.notFound("Table");
        }

        if (tables.table_name !== undefined) {
            tables.table_name = tables.table_name.trim();
            if (!tables.table_name) {
                throw AppError.badRequest("Table name is required");
            }
        }

        const normalizedIncomingName = tables.table_name?.trim().toLowerCase();
        const normalizedCurrentName = tableToUpdate.table_name?.trim().toLowerCase();

        if (normalizedIncomingName && normalizedIncomingName !== normalizedCurrentName) {
            const existingTable = await this.tablesModel.findOneByName(tables.table_name, tableToUpdate.branch_id);
            if (existingTable && existingTable.id !== id) {
                throw AppError.conflict("Table name already exists");
            }
        }

        const effectiveBranchId = tableToUpdate.branch_id || branchId || tables.branch_id;
        const updatedTable = await this.tablesModel.update(id, tables, effectiveBranchId);
        await this.orderSummarySnapshotService.syncTableMetadata(id);
        await this.invalidateOrderReadModels(effectiveBranchId);
        this.invalidateTablesCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.update, updatedTable);
        }
        return updatedTable;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.tablesModel.findOne(id, branchId);
        if (!existing) {
            throw AppError.notFound("Table");
        }

        const effectiveBranchId = existing.branch_id || branchId;
        const orderCount = await getRepository(SalesOrder).count({
            where: effectiveBranchId
                ? ({ table_id: id, branch_id: effectiveBranchId } as any)
                : ({ table_id: id } as any),
        });
        if (orderCount > 0) {
            throw AppError.conflict("Table cannot be deleted because it is referenced by orders");
        }

        await this.tablesModel.delete(id, branchId);
        this.invalidateTablesCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.delete, { id });
        }
    }
}
