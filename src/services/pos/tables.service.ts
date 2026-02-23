import { randomBytes } from "crypto";
import { TablesModels } from "../../models/pos/tables.model";
import { SocketService } from "../socket.service";
import { Tables } from "../../entity/pos/Tables";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";
import { AppError } from "../../utils/AppError";

const QR_TOKEN_BYTES = Math.max(16, Number(process.env.TABLE_QR_TOKEN_BYTES || 24));
const QR_TOKEN_EXPIRE_DAYS = Number(process.env.TABLE_QR_TOKEN_EXPIRE_DAYS || 365);

export class TablesService {
    private socketService = SocketService.getInstance();

    constructor(private tablesModel: TablesModels) {}

    async findAll(
        page: number,
        limit: number,
        q?: string,
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Tables[]; total: number; page: number; last_page: number }> {
        return this.tablesModel.findAll(page, limit, q, branchId, sortCreated);
    }

    async findOne(id: string, branchId?: string): Promise<Tables | null> {
        return this.tablesModel.findOne(id, branchId);
    }

    async findOneByName(table_name: string, branchId?: string): Promise<Tables | null> {
        return this.tablesModel.findOneByName(table_name, branchId);
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

        throw new AppError("Unable to generate unique table QR token", 500);
    }

    async ensureQrToken(id: string, branchId?: string): Promise<Tables> {
        const table = await this.tablesModel.findOne(id, branchId);
        if (!table) {
            throw new AppError("Table not found", 404);
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

    async rotateQrToken(id: string, branchId?: string): Promise<Tables> {
        const table = await this.tablesModel.findOne(id, branchId);
        if (!table) {
            throw new AppError("Table not found", 404);
        }

        const token = await this.generateUniqueQrToken();
        const expiresAt = this.resolveQrExpiryDate();

        const updated = await this.tablesModel.updateQrToken(id, token, expiresAt, branchId || table.branch_id);
        const effectiveBranchId = updated.branch_id || branchId;
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.update, updated);
        }
        return updated;
    }

    async create(tables: Tables): Promise<Tables> {
        if (!tables.table_name) {
            throw new AppError("Table name is required", 400);
        }

        const existingTable = await this.tablesModel.findOneByName(tables.table_name, tables.branch_id);
        if (existingTable) {
            throw new AppError("Table name already exists", 409);
        }

        if (!tables.qr_code_token) {
            tables.qr_code_token = await this.generateUniqueQrToken();
        }

        if (tables.qr_code_expires_at === undefined) {
            tables.qr_code_expires_at = this.resolveQrExpiryDate();
        }

        const createdTable = await this.tablesModel.create(tables);
        if (createdTable.branch_id) {
            this.socketService.emitToBranch(createdTable.branch_id, RealtimeEvents.tables.create, createdTable);
        }
        return createdTable;
    }

    async update(id: string, tables: Tables, branchId?: string): Promise<Tables> {
        const tableToUpdate = await this.tablesModel.findOne(id, branchId);
        if (!tableToUpdate) {
            throw new AppError("Table not found", 404);
        }

        if (tables.table_name && tables.table_name !== tableToUpdate.table_name) {
            const existingTable = await this.tablesModel.findOneByName(tables.table_name, tableToUpdate.branch_id);
            if (existingTable) {
                throw new AppError("Table name already exists", 409);
            }
        }

        const effectiveBranchId = tableToUpdate.branch_id || branchId || tables.branch_id;
        const updatedTable = await this.tablesModel.update(id, tables, effectiveBranchId);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.update, updatedTable);
        }
        return updatedTable;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.tablesModel.findOne(id, branchId);
        if (!existing) {
            throw new AppError("Table not found", 404);
        }
        await this.tablesModel.delete(id, branchId);
        const effectiveBranchId = existing.branch_id || branchId;
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.delete, { id });
        }
    }
}
