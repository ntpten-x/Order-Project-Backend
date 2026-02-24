import { Request, Response } from "express";
import { TablesService } from "../../services/pos/tables.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { getBranchId } from "../../middleware/branch.middleware";
import { setPrivateSwrHeaders } from "../../utils/cacheHeaders";
import { parseCreatedSort } from "../../utils/sortCreated";

export class TablesController {
    constructor(private tablesService: TablesService) {}

    private sanitizeIncomingPayload(body: Record<string, unknown>): void {
        delete body.qr_code_token;
        delete body.qr_code_expires_at;
    }

    private sanitizeTableResponse<T extends Record<string, any>>(table: T): Omit<T, "qr_code_token" | "qr_code_expires_at"> {
        const { qr_code_token: _qrCodeToken, qr_code_expires_at: _qrCodeExpiresAt, ...rest } = table;
        return rest;
    }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const rawLimit = parseInt(req.query.limit as string);
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
        const q = (req.query.q as string | undefined) || undefined;
        const sortCreated = parseCreatedSort(req.query.sort_created);
        const branchId = getBranchId(req as any);

        const result = await this.tablesService.findAll(page, limit, q, branchId, sortCreated);

        if (result.data && result.total !== undefined) {
            setPrivateSwrHeaders(res);
            const sanitized = result.data.map((table) => this.sanitizeTableResponse(table as Record<string, any>));
            return ApiResponses.paginated(res, sanitized as any[], {
                page: result.page || page,
                limit,
                total: result.total,
            });
        }

        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, result);
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const table = await this.tablesService.findOne(req.params.id, branchId);
        if (!table) {
            throw AppError.notFound("Table");
        }
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, this.sanitizeTableResponse(table as Record<string, any>));
    });

    findByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const table = await this.tablesService.findOneByName(req.params.name, branchId);
        if (!table) {
            throw AppError.notFound("Table");
        }
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, this.sanitizeTableResponse(table as Record<string, any>));
    });

    findAllQrCodes = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const rawLimit = parseInt(req.query.limit as string);
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
        const q = (req.query.q as string | undefined) || undefined;
        const sortCreated = parseCreatedSort(req.query.sort_created);
        const branchId = getBranchId(req as any);

        const result = await this.tablesService.findAllWithQrCodes(page, limit, q, branchId, sortCreated);
        setPrivateSwrHeaders(res);
        return ApiResponses.paginated(res, result.data, {
            page: result.page || page,
            limit,
            total: result.total,
        });
    });

    getQrToken = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const table = await this.tablesService.ensureQrToken(req.params.id, branchId);
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, {
            table_id: table.id,
            table_name: table.table_name,
            qr_code_token: table.qr_code_token,
            qr_code_expires_at: table.qr_code_expires_at,
            customer_path: table.qr_code_token ? `/order/${table.qr_code_token}` : null,
        });
    });

    rotateQrToken = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const table = await this.tablesService.rotateQrToken(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.TABLE_UPDATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Tables",
            entity_id: table.id,
            branch_id: branchId,
            new_values: {
                qr_code_token_rotated: true,
                qr_code_expires_at: table.qr_code_expires_at,
            },
            path: req.originalUrl,
            method: req.method,
            description: `Rotate table QR token ${table.id}`,
        });

        return ApiResponses.ok(res, {
            table_id: table.id,
            table_name: table.table_name,
            qr_code_token: table.qr_code_token,
            qr_code_expires_at: table.qr_code_expires_at,
            customer_path: table.qr_code_token ? `/order/${table.qr_code_token}` : null,
        });
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        this.sanitizeIncomingPayload(req.body as Record<string, unknown>);
        const table = await this.tablesService.create(req.body);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.TABLE_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Tables",
            entity_id: (table as any).id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create table ${(table as any).table_name || (table as any).id}`,
        });

        return ApiResponses.created(res, this.sanitizeTableResponse(table as Record<string, any>));
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        this.sanitizeIncomingPayload(req.body as Record<string, unknown>);
        const oldTable = await this.tablesService.findOne(req.params.id, branchId);
        const table = await this.tablesService.update(req.params.id, req.body, branchId);

        if (table) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.TABLE_UPDATE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "Tables",
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldTable as any,
                new_values: req.body,
                path: req.originalUrl,
                method: req.method,
                description: `Update table ${req.params.id}`,
            });
        }

        if (!table) {
            throw AppError.notFound("Table");
        }
        return ApiResponses.ok(res, this.sanitizeTableResponse(table as Record<string, any>));
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const oldTable = await this.tablesService.findOne(req.params.id, branchId);
        await this.tablesService.delete(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.TABLE_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Tables",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldTable as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete table ${req.params.id}`,
        });
        return ApiResponses.ok(res, { message: "Table deleted successfully" });
    });
}
