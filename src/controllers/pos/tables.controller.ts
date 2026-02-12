import { Request, Response } from "express";
import { TablesService } from "../../services/pos/tables.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { getBranchId } from "../../middleware/branch.middleware";
import { setPrivateSwrHeaders } from "../../utils/cacheHeaders";

/**
 * Tables Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 * - Pagination support
 */
export class TablesController {
    constructor(private tablesService: TablesService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const rawLimit = parseInt(req.query.limit as string);
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
        const q = (req.query.q as string | undefined) || undefined;
        const branchId = getBranchId(req as any);

        const result = await this.tablesService.findAll(page, limit, q, branchId);
        
        // Check if result has pagination structure
        if (result.data && result.total !== undefined) {
            setPrivateSwrHeaders(res);
            return ApiResponses.paginated(res, result.data, {
                page: result.page || page,
                limit: limit,
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
            throw AppError.notFound("โต๊ะ");
        }
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, table);
    });

    findByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const table = await this.tablesService.findOneByName(req.params.name, branchId);
        if (!table) {
            throw AppError.notFound("โต๊ะ");
        }
        setPrivateSwrHeaders(res);
        return ApiResponses.ok(res, table);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
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

        return ApiResponses.created(res, table);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
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
            throw AppError.notFound("โต๊ะ");
        }
        return ApiResponses.ok(res, table);
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
        return ApiResponses.ok(res, { message: "ลบข้อมูลโต๊ะสำเร็จ" });
    });
}
