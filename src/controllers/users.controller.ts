import { UsersService } from "../services/users.service";
import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponses } from "../utils/ApiResponse";
import { AppError } from "../utils/AppError";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../utils/auditLogger";
import { getClientIp } from "../utils/securityLogger";
import { setNoStoreHeaders } from "../utils/cacheHeaders";

export class UsersController {
    constructor(private usersService: UsersService) { }

    private sanitizeUserPayload(payload: any) {
        if (!payload || typeof payload !== "object") return payload;
        const { password: _password, ...rest } = payload;
        return rest;
    }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const role = req.query.role as string;
        const users = await this.usersService.findAll(role ? { role } : undefined);
        setNoStoreHeaders(res);
        return ApiResponses.ok(res, users);
    })

    findOne = catchAsync(async (req: Request, res: Response) => {
        const user = await this.usersService.findOne(req.params.id);
        if (!user) {
            throw AppError.notFound("User");
        }
        setNoStoreHeaders(res);
        return ApiResponses.ok(res, user);
    })

    create = catchAsync(async (req: Request, res: Response) => {
        const user = await this.usersService.create(req.body);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.USER_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Users",
            entity_id: user.id,
            branch_id: user.branch_id || userInfo.branch_id,
            new_values: this.sanitizeUserPayload(req.body),
            path: req.originalUrl,
            method: req.method,
            description: `Create user ${user.username || user.id}`,
        });

        return ApiResponses.created(res, user);
    })

    update = catchAsync(async (req: Request, res: Response) => {
        const oldUser = await this.usersService.findOne(req.params.id);
        const user = await this.usersService.update(req.params.id, req.body);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.USER_UPDATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Users",
            entity_id: req.params.id,
            branch_id: user.branch_id || userInfo.branch_id,
            old_values: this.sanitizeUserPayload(oldUser),
            new_values: this.sanitizeUserPayload(req.body),
            path: req.originalUrl,
            method: req.method,
            description: `Update user ${user.username || user.id}`,
        });

        return ApiResponses.ok(res, user);
    })

    delete = catchAsync(async (req: Request, res: Response) => {
        const oldUser = await this.usersService.findOne(req.params.id);
        await this.usersService.delete(req.params.id);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.USER_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Users",
            entity_id: req.params.id,
            branch_id: oldUser?.branch_id || userInfo.branch_id,
            old_values: this.sanitizeUserPayload(oldUser),
            path: req.originalUrl,
            method: req.method,
            description: `Delete user ${req.params.id}`,
        });

        return ApiResponses.noContent(res);
    })


}
