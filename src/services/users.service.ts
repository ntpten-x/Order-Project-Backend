import { Users } from "../entity/Users";
import { UsersModels } from "../models/users.model";
import * as bcrypt from "bcrypt";
import { SocketService } from "./socket.service";
import { RealtimeEvents } from "../utils/realtimeEvents";
import { PermissionScope } from "../middleware/permission.middleware";
import { metrics } from "../utils/metrics";
import { invalidatePermissionDecisionCacheByUser } from "../utils/permissionCache";
import { CreatedSort } from "../utils/sortCreated";
import { AppError } from "../utils/AppError";

type AccessContext = {
    scope?: PermissionScope;
    actorUserId?: string;
};

export class UsersService {
    private socketService = SocketService.getInstance();

    constructor(private usersModel: UsersModels) { }

    private async invalidateDecisionCacheSafely(userId: string): Promise<void> {
        try {
            await invalidatePermissionDecisionCacheByUser(userId);
        } catch (error) {
            console.warn("[UsersService] Failed to invalidate permission decision cache", {
                userId,
                error,
            });
        }
    }

    async findAll(
        filters?: { role?: string; q?: string; status?: "active" | "inactive" },
        access?: AccessContext,
        sortCreated: CreatedSort = "old"
    ): Promise<Users[]> {
        try {
            return this.usersModel.findAll(filters, access, sortCreated);
        } catch (error) {
            throw error;
        }
    }

    async findAllPaginated(
        filters: { role?: string; q?: string; status?: "active" | "inactive" } | undefined,
        page: number,
        limit: number,
        access?: AccessContext,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Users[]; total: number; page: number; limit: number; last_page: number }> {
        try {
            return this.usersModel.findAllPaginated(filters, page, limit, access, sortCreated);
        } catch (error) {
            throw error;
        }
    }

    async findOne(id: string, access?: AccessContext): Promise<Users | null> {
        try {
            return this.usersModel.findOne(id, access);
        } catch (error) {
            throw error;
        }
    }

    async create(users: Users): Promise<Users> {
        try {
            const findUser = await this.usersModel.findOneByUsername(users.username);
            if (findUser) {
                throw AppError.conflict(`Username ${users.username} already exists`);
            }
            users.password = await bcrypt.hash(users.password, 10);
            await this.usersModel.create(users);
            const createdUser = await this.usersModel.findOneByUsername(users.username);
            this.socketService.emitToRole("Admin", RealtimeEvents.users.create, createdUser);
            return createdUser!;
        } catch (error) {
            throw error;
        }
    }

    async update(id: string, users: Users, actorUserId?: string): Promise<Users> {
        try {
            const findUser = await this.usersModel.findOne(id);
            if (!findUser) {
                throw AppError.notFound("User");
            }
            const roleChanged = !!users.roles_id && users.roles_id !== findUser.roles_id;
            const disabledForOffboarding = typeof users.is_use === "boolean" && users.is_use === false && findUser.is_use !== false;

            if (users.password) {
                users.password = await bcrypt.hash(users.password, 10);
            }
            if (users.username && findUser.username !== users.username) {
                const findUserByUsername = await this.usersModel.findOneByUsername(users.username);
                if (findUserByUsername) {
                    throw AppError.conflict(`Username ${users.username} already exists`);
                }
            }

            if (disabledForOffboarding) {
                const revoked = await this.usersModel.revokeUserPermissionOverrides(id, actorUserId);
                if (revoked > 0) {
                    metrics.countPrivilegeEvent({
                        event: "override_revoke_offboarding",
                        result: "success",
                    });
                }
            }

            await this.usersModel.update(id, users);
            if (disabledForOffboarding || roleChanged) {
                await this.invalidateDecisionCacheSafely(id);
            }
            const updatedUser = await this.usersModel.findOne(id);
            this.socketService.emitToRole("Admin", RealtimeEvents.users.update, updatedUser);
            return updatedUser!;
        } catch (error) {
            if (typeof users.is_use === "boolean" && users.is_use === false) {
                metrics.countPrivilegeEvent({
                    event: "override_revoke_offboarding",
                    result: "error",
                });
            }
            throw error;
        }
    }

    async delete(id: string): Promise<void> {
        try {
            const existing = await this.usersModel.findOne(id);
            if (!existing) {
                throw AppError.notFound("User");
            }

            await this.usersModel.delete(id);
            await this.invalidateDecisionCacheSafely(id);
            this.socketService.emitToRole("Admin", RealtimeEvents.users.delete, { id });
        } catch (error) {
            throw error;
        }
    }
}
