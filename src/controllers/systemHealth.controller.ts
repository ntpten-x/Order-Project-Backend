import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { ApiResponses } from "../utils/ApiResponse";
import { catchAsync } from "../utils/catchAsync";
import { setNoStoreHeaders } from "../utils/cacheHeaders";
import { SystemHealthService } from "../services/systemHealth.service";

const systemHealthService = new SystemHealthService();
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

function parseQueryValue(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    return undefined;
}

export class SystemHealthController {
    getHealth = catchAsync(async (req: AuthRequest, res: Response) => {
        const methodQuery = parseQueryValue(req.query.method)?.trim().toUpperCase();
        const minSamplesQuery = parseQueryValue(req.query.minSamples)?.trim();
        const minSamplesParsed = Number(minSamplesQuery);

        const report = await systemHealthService.getReport({
            slowEndpointMethod:
                methodQuery && methodQuery !== "ALL" && ALLOWED_METHODS.has(methodQuery) ? methodQuery : undefined,
            slowEndpointMinSamples: Number.isFinite(minSamplesParsed) ? minSamplesParsed : undefined,
        });
        setNoStoreHeaders(res);
        return ApiResponses.ok(res, report);
    });
}
