import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getBranchId } from "../../middleware/branch.middleware";
import { PermissionScope } from "../../middleware/permission.middleware";
import { PosBackgroundJobNames } from "../../queues/posBackground.queue";
import {
    BackgroundJobsService,
    PosBackgroundJobAccessContext,
    PosBackgroundJobStatus,
} from "../../services/pos/backgroundJobs.service";
import { ApiResponses } from "../../utils/ApiResponse";
import { catchAsync } from "../../utils/catchAsync";

export class BackgroundJobsController {
    constructor(private readonly backgroundJobsService: BackgroundJobsService) {}

    private isAdmin(req: AuthRequest): boolean {
        return req.user?.roles?.roles_name === "Admin";
    }

    private canAccessJob(status: PosBackgroundJobStatus, context: PosBackgroundJobAccessContext): boolean {
        if (context.isAdmin || context.scope === "all") {
            return true;
        }

        const jobBranchId = "branchId" in status.data ? status.data.branchId : undefined;
        const jobUserId =
            "requestedByUserId" in status.data
                ? status.data.requestedByUserId
                : status.data.triggeredByUserId;

        if (context.scope === "own") {
            return Boolean(context.userId && jobUserId && context.userId === jobUserId);
        }

        if (context.scope === "branch") {
            if (context.branchId && jobBranchId && context.branchId === jobBranchId) {
                return true;
            }

            return Boolean(context.userId && jobUserId && context.userId === jobUserId);
        }

        return false;
    }

    private async getScopedJobStatus(
        req: AuthRequest,
        expectedJobName: PosBackgroundJobNames,
        requiredScopeFallback: PermissionScope = "branch"
    ): Promise<PosBackgroundJobStatus | null> {
        const status = await this.backgroundJobsService.getJobStatus(req.params.jobId);
        if (!status || status.name !== expectedJobName) {
            return null;
        }

        const accessContext: PosBackgroundJobAccessContext = {
            userId: req.user?.id,
            branchId: getBranchId(req as any),
            scope: req.permission?.scope ?? requiredScopeFallback,
            isAdmin: this.isAdmin(req),
        };

        return this.canAccessJob(status, accessContext) ? status : null;
    }

    enqueueGenerateReport = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = getBranchId(req as any);
        const job = await this.backgroundJobsService.enqueueGenerateReport({
            reportType: req.body.reportType,
            format: req.body.format,
            filters: req.body.filters,
            branchId,
            requestedByUserId: req.user!.id,
        });

        return ApiResponses.accepted(res, {
            jobId: String(job.id),
            queueName: job.queueName,
            jobName: job.name,
            state: "waiting",
        });
    });

    getGenerateReportStatus = catchAsync(async (req: AuthRequest, res: Response) => {
        const status = await this.getScopedJobStatus(req, PosBackgroundJobNames.GenerateReport, "branch");
        if (!status) {
            return ApiResponses.notFound(res, "Background job");
        }

        return ApiResponses.ok(res, status);
    });

    enqueueSyncStock = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = getBranchId(req as any);
        const job = await this.backgroundJobsService.enqueueSyncStock({
            branchId: branchId!,
            productId: req.body.productId,
            reason: req.body.reason,
            triggeredByUserId: req.user?.id,
        });

        return ApiResponses.accepted(res, {
            jobId: String(job.id),
            queueName: job.queueName,
            jobName: job.name,
            state: "waiting",
        });
    });

    getSyncStockStatus = catchAsync(async (req: AuthRequest, res: Response) => {
        const status = await this.getScopedJobStatus(req, PosBackgroundJobNames.SyncStock, "branch");
        if (!status) {
            return ApiResponses.notFound(res, "Background job");
        }

        return ApiResponses.ok(res, status);
    });
}
