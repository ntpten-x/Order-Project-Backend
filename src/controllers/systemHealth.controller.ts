import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { ApiResponses } from "../utils/ApiResponse";
import { catchAsync } from "../utils/catchAsync";
import { setNoStoreHeaders } from "../utils/cacheHeaders";
import { SystemHealthService } from "../services/systemHealth.service";

const systemHealthService = new SystemHealthService();

export class SystemHealthController {
    getHealth = catchAsync(async (_req: AuthRequest, res: Response) => {
        const report = await systemHealthService.getReport();
        setNoStoreHeaders(res);
        return ApiResponses.ok(res, report);
    });
}
