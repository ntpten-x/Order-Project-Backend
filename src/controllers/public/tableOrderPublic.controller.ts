import { Request, Response } from "express";
import { PublicTableOrderService } from "../../services/public/tableOrderPublic.service";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponses } from "../../utils/ApiResponse";

export class PublicTableOrderController {
    constructor(private publicTableOrderService: PublicTableOrderService) {}

    private setNoStoreHeaders(res: Response): void {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
    }

    bootstrap = catchAsync(async (req: Request, res: Response) => {
        const data = await this.publicTableOrderService.getBootstrapByToken(req.params.token);
        this.setNoStoreHeaders(res);
        return ApiResponses.ok(res, data);
    });

    getActiveOrder = catchAsync(async (req: Request, res: Response) => {
        const data = await this.publicTableOrderService.getActiveOrderByToken(req.params.token);
        this.setNoStoreHeaders(res);
        return ApiResponses.ok(res, data);
    });

    submit = catchAsync(async (req: Request, res: Response) => {
        const data = await this.publicTableOrderService.submitByToken(req.params.token, req.body);
        this.setNoStoreHeaders(res);
        return ApiResponses.ok(res, data);
    });

    getOrder = catchAsync(async (req: Request, res: Response) => {
        const data = await this.publicTableOrderService.resolveOrderByToken(req.params.token, req.params.orderId);
        this.setNoStoreHeaders(res);
        return ApiResponses.ok(res, data);
    });
}
