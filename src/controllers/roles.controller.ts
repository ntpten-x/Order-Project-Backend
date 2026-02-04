import { RolesService } from "../services/roles.service"
import { Request, Response } from "express"
import { catchAsync } from "../utils/catchAsync"
import { ApiResponses } from "../utils/ApiResponse"
import { AppError } from "../utils/AppError"
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../utils/auditLogger"
import { getClientIp } from "../utils/securityLogger"

export class RolesController {
    constructor(private rolesService: RolesService) { }
    findAll = catchAsync(async (_req: Request, res: Response) => {
        const roles = await this.rolesService.findAll()
        return ApiResponses.ok(res, roles)
    })

    findOne = catchAsync(async (req: Request, res: Response) => {
        const role = await this.rolesService.findOne(req.params.id)
        if (!role) {
            throw AppError.notFound("Role")
        }
        return ApiResponses.ok(res, role)
    })

    create = catchAsync(async (req: Request, res: Response) => {
        const role = await this.rolesService.create(req.body)

        const userInfo = getUserInfoFromRequest(req as any)
        await auditLogger.log({
            action_type: AuditActionType.ROLE_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Roles",
            entity_id: role.id,
            branch_id: userInfo.branch_id,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create role ${role.roles_name || role.id}`,
        })

        return ApiResponses.created(res, role)
    })

    update = catchAsync(async (req: Request, res: Response) => {
        const oldRole = await this.rolesService.findOne(req.params.id)
        const role = await this.rolesService.update(req.params.id, req.body)

        const userInfo = getUserInfoFromRequest(req as any)
        await auditLogger.log({
            action_type: AuditActionType.ROLE_UPDATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Roles",
            entity_id: req.params.id,
            branch_id: userInfo.branch_id,
            old_values: oldRole as any,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Update role ${req.params.id}`,
        })

        return ApiResponses.ok(res, role)
    })

    delete = catchAsync(async (req: Request, res: Response) => {
        const oldRole = await this.rolesService.findOne(req.params.id)
        await this.rolesService.delete(req.params.id)

        const userInfo = getUserInfoFromRequest(req as any)
        await auditLogger.log({
            action_type: AuditActionType.ROLE_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Roles",
            entity_id: req.params.id,
            branch_id: userInfo.branch_id,
            old_values: oldRole as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete role ${req.params.id}`,
        })

        return ApiResponses.noContent(res)
    })
}
