import { Users } from "../entity/Users";
import { getDbContext, getDbManager, getRepository } from "../database/dbContext";
import { Brackets } from "typeorm";
import { PermissionScope } from "../middleware/permission.middleware";

type AccessContext = {
    scope?: PermissionScope;
    actorUserId?: string;
};

export class UsersModels {
    async findAll(filters?: { role?: string }, access?: AccessContext): Promise<Users[]> {
        try {
            const usersRepository = getRepository(Users);
            const ctx = getDbContext();
            const query = usersRepository.createQueryBuilder("users")
                .leftJoinAndSelect("users.roles", "roles")
                .leftJoinAndSelect("users.branch", "branch")
                .orderBy("users.is_active", "DESC")
                .addOrderBy("users.create_date", "ASC");

            if (filters?.role) {
                query.where("roles.roles_name = :role", { role: filters.role });
            }

            // Respect active branch context (e.g. Admin switching branch) when present.
            if (ctx?.branchId) {
                query.andWhere("users.branch_id = :branchId", { branchId: ctx.branchId });
            }

            // Managers can only view/manage Employee users in their own branch, plus themselves.
            if (ctx?.role === "Manager" && !ctx?.isAdmin) {
                query.andWhere(
                    new Brackets((qb) => {
                        qb.where("roles.roles_name = :employeeRole", { employeeRole: "Employee" });
                        if (ctx.userId) {
                            qb.orWhere("users.id = :selfId", { selfId: ctx.userId });
                        }
                    })
                );
            }

            if (access?.scope === "none") {
                query.andWhere("1=0");
            }

            if (access?.scope === "own" && access.actorUserId) {
                query.andWhere("users.id = :actorUserId", { actorUserId: access.actorUserId });
            }

            return await query.getMany();
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, access?: AccessContext): Promise<Users | null> {
        try {
            const ctx = getDbContext();
            const query = getRepository(Users).createQueryBuilder("users")
                .leftJoinAndSelect("users.roles", "roles")
                .leftJoinAndSelect("users.branch", "branch")
                .where("users.id = :id", { id });

            if (ctx?.branchId) {
                query.andWhere("users.branch_id = :branchId", { branchId: ctx.branchId });
            }

            if (ctx?.role === "Manager" && !ctx?.isAdmin) {
                query.andWhere(
                    new Brackets((qb) => {
                        qb.where("roles.roles_name = :employeeRole", { employeeRole: "Employee" });
                        if (ctx.userId) {
                            qb.orWhere("users.id = :selfId", { selfId: ctx.userId });
                        }
                    })
                );
            }

            if (access?.scope === "none") {
                query.andWhere("1=0");
            }

            if (access?.scope === "own" && access.actorUserId) {
                query.andWhere("users.id = :actorUserId", { actorUserId: access.actorUserId });
            }

            return await query.getOne();
        } catch (error) {
            throw error
        }
    }

    async findOneByUsername(username: string): Promise<Users | null> {
        try {
            // Username is globally unique; do not apply branch scoping here.
            return getRepository(Users).createQueryBuilder("users")
                .leftJoinAndSelect("users.roles", "roles")
                .leftJoinAndSelect("users.branch", "branch")
                .where("users.username = :username", { username })
                .getOne()
        } catch (error) {
            throw error
        }
    }

    async create(users: Users): Promise<Users> {
        try {
            const ctx = getDbContext();
            // If an active branch context exists (Admin switched branch), force the user into that branch.
            if (ctx?.branchId) {
                (users as any).branch_id = ctx.branchId;
            }
            return getRepository(Users).save(users)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, users: Users): Promise<Users> {
        try {
            const ctx = getDbContext();

            // If an active branch context exists, only allow updates within that branch.
            if (ctx?.branchId) {
                const existing = await this.findOne(id);
                if (!existing) {
                    throw new Error("ไม่พบผู้ใช้");
                }
                (users as any).branch_id = ctx.branchId;
            }

            return getRepository(Users).save({ ...users, id })
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            const ctx = getDbContext();
            const usersRepo = getRepository(Users);

            if (ctx?.branchId) {
                const result = await usersRepo.delete({ id, branch_id: ctx.branchId } as any);
                if (!result.affected) {
                    throw new Error("ไม่พบผู้ใช้");
                }
                return;
            }

            await usersRepo.delete(id)
        } catch (error) {
            throw error
        }
    }

    async revokeUserPermissionOverrides(userId: string, actorUserId?: string): Promise<number> {
        const manager = getDbManager();
        return manager.transaction(async (tx) => {
            const beforeRows = await tx.query(
                `
                    SELECT COUNT(*)::int AS total
                    FROM user_permissions
                    WHERE user_id = $1
                `,
                [userId]
            );
            const beforeTotal = Number(beforeRows?.[0]?.total ?? 0);

            if (beforeTotal <= 0) {
                return 0;
            }

            await tx.query(`DELETE FROM user_permissions WHERE user_id = $1`, [userId]);

            if (actorUserId) {
                await tx.query(
                    `
                        INSERT INTO permission_audits (
                            actor_user_id,
                            target_type,
                            target_id,
                            action_type,
                            payload_before,
                            payload_after,
                            reason
                        )
                        VALUES ($1, 'user', $2, 'offboarding_revoke', $3::jsonb, $4::jsonb, $5)
                    `,
                    [
                        actorUserId,
                        userId,
                        JSON.stringify({ overrides_count: beforeTotal }),
                        JSON.stringify({ overrides_count: 0 }),
                        "Automatic revoke on user disable/offboarding",
                    ]
                );
            }

            return beforeTotal;
        });
    }
}
