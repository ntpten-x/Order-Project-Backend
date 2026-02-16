import { Response } from "express";
import { AuditService } from "../services/audit.service";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponses } from "../utils/ApiResponse";
import { AppError } from "../utils/AppError";
import { AuthRequest } from "../middleware/auth.middleware";
import { setNoStoreHeaders } from "../utils/cacheHeaders";
import { parseCreatedSort } from "../utils/sortCreated";
import { redactAuditPayload } from "../utils/auditRedaction";

export class AuditController {
    private auditService = new AuditService();

    getLogs = catchAsync(async (req: AuthRequest, res: Response) => {
        const scope = req.permission?.scope ?? "none";
        if (!req.user?.id) {
            return ApiResponses.unauthorized(res, "Authentication required");
        }
        if (scope === "none") {
            return ApiResponses.forbidden(res, "Access denied");
        }

        const query = req.query as Record<string, string | string[] | undefined>;

        const page = query.page ? Number(query.page) : 1;
        const limit = query.limit ? Number(query.limit) : 20;
        const sortCreated = parseCreatedSort(query.sort_created);

        const requestedBranch = query.branch_id as string | undefined;
        const actorBranchId = req.user.branch_id;

        // Enforce data-scope based on resolved permission, not just role name.
        // - all: can query any branch/user
        // - branch: forced to actor branch
        // - own: forced to actor user (and by default to actor branch as an extra guard)
        const effectiveBranchId =
            scope === "all"
                ? requestedBranch
                : actorBranchId;

        if (scope !== "all" && requestedBranch && requestedBranch !== actorBranchId) {
            return ApiResponses.forbidden(res, "Access denied");
        }

        const requestedUserId = query.user_id as string | undefined;
        const effectiveUserId = scope === "own" ? req.user.id : requestedUserId;

        const filters = {
            page,
            limit,
            action_type: query.action_type as any,
            entity_type: query.entity_type as string | undefined,
            entity_id: query.entity_id as string | undefined,
            user_id: effectiveUserId as string | undefined,
            branch_id: effectiveBranchId as string | undefined,
            start_date: query.start_date ? new Date(String(query.start_date)) : undefined,
            end_date: query.end_date ? new Date(String(query.end_date)) : undefined,
            search: query.search as string | undefined,
            sort_created: sortCreated,
        };

        const { logs, total } = await this.auditService.getLogs(filters);

        setNoStoreHeaders(res);
        const sanitizedLogs = logs.map((log) => ({
            ...log,
            old_values: typeof log.old_values === "undefined" ? undefined : redactAuditPayload(log.old_values),
            new_values: typeof log.new_values === "undefined" ? undefined : redactAuditPayload(log.new_values),
        }));
        return ApiResponses.paginated(res, sanitizedLogs, {
            page: filters.page || 1,
            limit: filters.limit || 20,
            total,
        });
    });

    getById = catchAsync(async (req: AuthRequest, res: Response) => {
        const log = await this.auditService.getById(req.params.id);

        if (!log) {
            throw AppError.notFound("Audit log");
        }

        // Access is enforced by `enforceAuditLogTargetScope` middleware on the route.

        setNoStoreHeaders(res);
        const sanitized = {
            ...log,
            old_values: typeof log.old_values === "undefined" ? undefined : redactAuditPayload(log.old_values),
            new_values: typeof log.new_values === "undefined" ? undefined : redactAuditPayload(log.new_values),
        };
        return ApiResponses.ok(res, sanitized);
    });
}
