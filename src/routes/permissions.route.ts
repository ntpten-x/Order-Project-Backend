import { Router } from "express";
import { authenticateToken } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { authorizePermission } from "../middleware/permission.middleware";
import { PermissionsModel } from "../models/permissions.model";
import { RolesModels } from "../models/roles.model";
import { UsersModels } from "../models/users.model";
import { PermissionsService } from "../services/permissions.service";
import { PermissionsController } from "../controllers/permissions.controller";
import {
    permissionApprovalsQuerySchema,
    permissionAuditsQuerySchema,
    permissionRoleIdParamSchema,
    permissionUserIdParamSchema,
    reviewApprovalSchema,
    reviewRejectApprovalSchema,
    simulatePermissionSchema,
    updateUserPermissionsSchema,
} from "../utils/schemas/permissions.schema";

const router = Router();

const permissionsModel = new PermissionsModel();
const rolesModel = new RolesModels();
const usersModel = new UsersModels();
const permissionsService = new PermissionsService(permissionsModel, rolesModel, usersModel);
const permissionsController = new PermissionsController(permissionsService);

router.use(authenticateToken);

router.get(
    "/roles/:id/effective",
    authorizePermission("permissions.page", "view"),
    validate(permissionRoleIdParamSchema),
    permissionsController.getRoleEffective
);
router.get(
    "/users/:id/effective",
    authorizePermission("permissions.page", "view"),
    validate(permissionUserIdParamSchema),
    permissionsController.getUserEffective
);
router.put(
    "/users/:id",
    authorizePermission("permissions.page", "update"),
    validate(updateUserPermissionsSchema),
    permissionsController.updateUserPermissions
);
router.post(
    "/simulate",
    authorizePermission("permissions.page", "view"),
    validate(simulatePermissionSchema),
    permissionsController.simulate
);
router.get(
    "/audits",
    authorizePermission("permissions.page", "view"),
    validate(permissionAuditsQuerySchema),
    permissionsController.getAudits
);
router.get(
    "/approvals",
    authorizePermission("permissions.page", "view"),
    validate(permissionApprovalsQuerySchema),
    permissionsController.getOverrideApprovals
);
router.post(
    "/approvals/:id/approve",
    authorizePermission("permissions.page", "update"),
    validate(reviewApprovalSchema),
    permissionsController.approveOverride
);
router.post(
    "/approvals/:id/reject",
    authorizePermission("permissions.page", "update"),
    validate(reviewRejectApprovalSchema),
    permissionsController.rejectOverride
);

export default router;
