
import { Request, Response } from "express";
import { PaymentAccountService } from "../../services/pos/PaymentAccount.service";
import { PaymentAccountModel } from "../../models/pos/PaymentAccount.model";
import { getBranchId } from "../../middleware/branch.middleware";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponses } from "../../utils/ApiResponse";
import { AppError } from "../../utils/AppError";
import { getClientIp } from "../../utils/securityLogger";

export class PaymentAccountController {
    private service: PaymentAccountService

    constructor() {
        this.service = new PaymentAccountService(new PaymentAccountModel());
    }

    getAccounts = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (!branchId) throw AppError.forbidden("Access denied: No branch assigned to user");

        const accounts = await this.service.getAccounts(branchId);
        return ApiResponses.ok(res, accounts);
    });

    createAccount = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (!branchId) throw AppError.forbidden("Access denied: No branch assigned to user");

        const account = await this.service.createAccount(branchId, req.body);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.PAYMENT_ACCOUNT_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "ShopPaymentAccount",
            entity_id: (account as any).id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create payment account ${(account as any).id}`,
        });

        return ApiResponses.created(res, account);
    });

    updateAccount = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (!branchId) throw AppError.forbidden("Access denied: No branch assigned to user");

        const { id } = req.params;
        const oldAccount = (await this.service.getAccounts(branchId)).find((a: any) => a.id === id);
        const account = await this.service.updateAccount(branchId, id, req.body);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.PAYMENT_ACCOUNT_UPDATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "ShopPaymentAccount",
            entity_id: id,
            branch_id: branchId,
            old_values: oldAccount,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Update payment account ${id}`,
        });

        return ApiResponses.ok(res, account);
    });

    activateAccount = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (!branchId) throw AppError.forbidden("Access denied: No branch assigned to user");

        const { id } = req.params;
        const account = await this.service.activateAccount(branchId, id);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.PAYMENT_ACCOUNT_ACTIVATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "ShopPaymentAccount",
            entity_id: id,
            branch_id: branchId,
            new_values: { is_active: true },
            path: req.originalUrl,
            method: req.method,
            description: `Activate payment account ${id}`,
        });

        return ApiResponses.ok(res, account);
    });

    deleteAccount = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (!branchId) throw AppError.forbidden("Access denied: No branch assigned to user");

        const { id } = req.params;
        const oldAccount = (await this.service.getAccounts(branchId)).find((a: any) => a.id === id);
        await this.service.deleteAccount(branchId, id);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.PAYMENT_ACCOUNT_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "ShopPaymentAccount",
            entity_id: id,
            branch_id: branchId,
            old_values: oldAccount,
            path: req.originalUrl,
            method: req.method,
            description: `Delete payment account ${id}`,
        });

        return ApiResponses.noContent(res);
    });
}
