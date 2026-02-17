import { NextFunction, Response } from "express";
import { AuthRequest } from "./auth.middleware";
import { ApiResponses } from "../utils/ApiResponse";
import { getDbContext, getRepository } from "../database/dbContext";
import { Roles } from "../entity/Roles";
import { Users } from "../entity/Users";

const ROLE_ADMIN = "Admin";
const ROLE_MANAGER = "Manager";
const ROLE_EMPLOYEE = "Employee";

async function getRoleNameById(rolesId: unknown): Promise<string | null> {
    if (!rolesId || typeof rolesId !== "string") return null;
    const role = await getRepository(Roles).findOne({ where: { id: rolesId } });
    return role?.roles_name ?? null;
}

let employeeRoleIdPromise: Promise<string | null> | null = null;
async function getEmployeeRoleId(): Promise<string | null> {
    if (!employeeRoleIdPromise) {
        employeeRoleIdPromise = (async () => {
            const byName = await getRepository(Roles).findOne({ where: { roles_name: ROLE_EMPLOYEE } as any });
            if (byName?.id) return byName.id;
            const byDisplay = await getRepository(Roles).findOne({ where: { display_name: ROLE_EMPLOYEE } as any });
            return byDisplay?.id ?? null;
        })();
    }
    return employeeRoleIdPromise;
}

function getUserRoleName(req: AuthRequest): string | undefined {
    return req.user?.roles?.roles_name;
}

/**
 * Manager constraints for /users endpoints:
 * - Can CRUD only `Employee` users in their own branch context (enforced by DB context + extra checks below).
 * - Can update self (limited fields) but cannot change role/branch/flags.
 * - Cannot create/update/delete Admin/Manager users.
 */
export const enforceUserManagementPolicy = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const actorRole = getUserRoleName(req);
    if (!actorRole) {
        return ApiResponses.unauthorized(res, "Authentication required");
    }

    const method = req.method.toUpperCase();

    // Admin: enforce create branch from current DB context (active branch cookie / assigned branch).
    // This prevents clients from spoofing branch_id in payload.
    if (actorRole === ROLE_ADMIN) {
        if (method === "POST") {
            const ctx = getDbContext();
            if (!ctx?.branchId) {
                return ApiResponses.forbidden(res, "Access denied: No active branch selected");
            }
            (req.body as any).branch_id = ctx.branchId;
        }
        return next();
    }

    // Non-manager roles have no business touching /users routes.
    if (actorRole !== ROLE_MANAGER) {
        return ApiResponses.forbidden(res, "Access denied: Insufficient permissions");
    }

    // Manager can list/read within branch (branch scoping is enforced by DB context / queries).
    if (method === "GET") return next();

    // Manager can create employees only.
    if (method === "POST") {
        const ctx = getDbContext();
        if (!ctx?.branchId) {
            return ApiResponses.forbidden(res, "Access denied: No branch assigned");
        }

        const employeeRoleId = await getEmployeeRoleId();
        if (!employeeRoleId) {
            return ApiResponses.internalError(res, "Employee role is not configured");
        }

        const requestedRoleId = (req.body as any)?.roles_id;
        if (requestedRoleId) {
            const requestedRoleName = await getRoleNameById(requestedRoleId);
            if (requestedRoleName !== ROLE_EMPLOYEE) {
                return ApiResponses.forbidden(res, "Managers can only create Employee users");
            }
        }

        // Enforce branch + role regardless of client payload.
        (req.body as any).branch_id = ctx.branchId;
        (req.body as any).roles_id = employeeRoleId;
        return next();
    }

    // For updates/deletes, validate target user role.
    const targetUserId = req.params?.id;
    if (!targetUserId) return ApiResponses.badRequest(res, "User id is required");

    const targetUser = await getRepository(Users).findOne({
        where: { id: targetUserId },
        relations: ["roles"],
    });

    if (!targetUser) {
        return ApiResponses.notFound(res, "User");
    }

    // Allow manager to update self, but not elevate/change system fields.
    if (targetUser.id === req.user?.id) {
        if (method === "PUT" || method === "PATCH") {
            const body = (req.body ?? {}) as any;
            const forbiddenFields = ["roles_id", "branch_id", "is_use", "is_active"];
            const hasForbidden = forbiddenFields.some((field) => body[field] !== undefined);
            if (hasForbidden) {
                return ApiResponses.forbidden(res, "Managers cannot change role/branch/status fields");
            }
            return next();
        }
        return ApiResponses.forbidden(res, "Managers cannot delete their own account");
    }

    const targetRoleName = targetUser.roles?.roles_name;
    if (targetRoleName !== ROLE_EMPLOYEE) {
        return ApiResponses.forbidden(res, "Managers can only manage Employee users");
    }

    if (method === "PUT" || method === "PATCH") {
        const ctx = getDbContext();
        if (!ctx?.branchId) {
            return ApiResponses.forbidden(res, "Access denied: No branch assigned");
        }

        const employeeRoleId = await getEmployeeRoleId();
        if (!employeeRoleId) {
            return ApiResponses.internalError(res, "Employee role is not configured");
        }

        const requestedRoleId = (req.body as any)?.roles_id;
        if (requestedRoleId) {
            const requestedRoleName = await getRoleNameById(requestedRoleId);
            if (requestedRoleName !== ROLE_EMPLOYEE) {
                return ApiResponses.forbidden(res, "Managers cannot change user role to Admin/Manager");
            }
        }

        // Enforce branch + role regardless of client payload.
        (req.body as any).branch_id = ctx.branchId;
        (req.body as any).roles_id = employeeRoleId;
    }

    return next();
};
