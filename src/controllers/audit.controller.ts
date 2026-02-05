import { Response } from "express";
import { AuditService } from "../services/audit.service";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponses } from "../utils/ApiResponse";
import { AppError } from "../utils/AppError";
import { AuthRequest } from "../middleware/auth.middleware";

export class AuditController {
    private auditService = new AuditService();

    getLogs = catchAsync(async (req: AuthRequest, res: Response) => {
        const isAdmin = req.user?.roles?.roles_name === "Admin";
        const query = req.query as Record<string, string | string[] | undefined>;

        const page = query.page ? Number(query.page) : 1;
        const limit = query.limit ? Number(query.limit) : 20;

        const requestedBranch = query.branch_id as string | undefined;
        const effectiveBranchId = isAdmin ? requestedBranch : req.user?.branch_id;

        // Non-admins cannot access other branches
        if (!isAdmin && requestedBranch && requestedBranch !== req.user?.branch_id) {
            return ApiResponses.forbidden(res, "Access denied");
        }

        const filters = {
            page,
            limit,
            action_type: query.action_type as any,
            entity_type: query.entity_type as string | undefined,
            entity_id: query.entity_id as string | undefined,
            user_id: query.user_id as string | undefined,
            branch_id: effectiveBranchId as string | undefined,
            start_date: query.start_date ? new Date(String(query.start_date)) : undefined,
            end_date: query.end_date ? new Date(String(query.end_date)) : undefined,
            search: query.search as string | undefined,
        };

        const { logs, total } = await this.auditService.getLogs(filters);

        return ApiResponses.paginated(res, logs, {
            page: filters.page || 1,
            limit: filters.limit || 20,
            total,
        });
    });

    getById = catchAsync(async (req: AuthRequest, res: Response) => {
        const isAdmin = req.user?.roles?.roles_name === "Admin";
        const log = await this.auditService.getById(req.params.id);

        if (!log) {
            throw AppError.notFound("Audit log");
        }

        if (!isAdmin && log.branch_id && log.branch_id !== req.user?.branch_id) {
            return ApiResponses.forbidden(res, "Access denied");
        }

        return ApiResponses.ok(res, log);
    });
}
