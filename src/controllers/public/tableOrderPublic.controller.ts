import { Request, Response } from "express";
import { PublicTableOrderService } from "../../services/public/tableOrderPublic.service";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponses, ErrorCodes } from "../../utils/ApiResponse";
import { AppError } from "../../utils/AppError";
import {
    clearPublicOrderIdempotency,
    commitPublicOrderIdempotency,
    reservePublicOrderIdempotency,
} from "../../utils/publicOrderIdempotency";

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
        const reservation = await reservePublicOrderIdempotency({
            token: req.params.token,
            idempotencyKeyHeader: req.header("idempotency-key") || req.header("x-idempotency-key") || undefined,
            payload: req.body,
        });

        if (reservation.status === "conflict") {
            throw new AppError(
                "Idempotency-Key was reused with a different payload",
                409,
                ErrorCodes.CONFLICT,
                {
                    reason: "IDEMPOTENCY_PAYLOAD_MISMATCH",
                },
            );
        }

        if (reservation.status === "in_progress") {
            throw new AppError(
                "A request with this Idempotency-Key is already in progress",
                409,
                ErrorCodes.CONFLICT,
                {
                    reason: "IDEMPOTENCY_IN_PROGRESS",
                },
            );
        }

        if (reservation.status === "replay") {
            this.setNoStoreHeaders(res);
            res.setHeader("Idempotency-Replayed", "true");
            return res.status(reservation.response.statusCode).json(reservation.response.body);
        }

        try {
            const data = await this.publicTableOrderService.submitByToken(req.params.token, req.body);
            const responseBody = {
                success: true,
                data,
            };

            if (reservation.status === "acquired") {
                await commitPublicOrderIdempotency(reservation.reservation, {
                    statusCode: 200,
                    body: responseBody,
                });
            }

            this.setNoStoreHeaders(res);
            return res.status(200).json(responseBody);
        } catch (error) {
            if (reservation.status === "acquired") {
                await clearPublicOrderIdempotency(reservation.reservation);
            }
            throw error;
        }
    });

    getOrder = catchAsync(async (req: Request, res: Response) => {
        const data = await this.publicTableOrderService.resolveOrderByToken(req.params.token, req.params.orderId);
        this.setNoStoreHeaders(res);
        return ApiResponses.ok(res, data);
    });
}
