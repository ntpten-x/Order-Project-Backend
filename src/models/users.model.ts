import { Users } from "../entity/Users";
import { getDbContext, getDbManager, getRepository } from "../database/dbContext";
import { Brackets } from "typeorm";
import { PermissionScope } from "../middleware/permission.middleware";
import { CreatedSort, createdSortToOrder } from "../utils/sortCreated";

type AccessContext = {
    scope?: PermissionScope;
    actorUserId?: string;
};

export class UsersModels {
    private buildFindAllQuery(
        filters?: { role?: string; q?: string; status?: "active" | "inactive" },
        access?: AccessContext,
        sortCreated: CreatedSort = "old"
    ) {
        const usersRepository = getRepository(Users);
        const ctx = getDbContext();
        const query = usersRepository.createQueryBuilder("users")
            .leftJoinAndSelect("users.roles", "roles")
            .leftJoinAndSelect("users.branch", "branch")
            .orderBy("users.is_active", "DESC")
            .addOrderBy("users.create_date", createdSortToOrder(sortCreated));

        if (filters?.role) {
            query.where("roles.roles_name = :role", { role: filters.role });
        }

        if (filters?.status === "active") {
            query.andWhere("users.is_active = true");
        } else if (filters?.status === "inactive") {
            query.andWhere("users.is_active = false");
        }

        if (filters?.q?.trim()) {
            const q = `%${filters.q.trim()}%`;
            query.andWhere(
                new Brackets((qb) => {
                    // Use ILIKE so Postgres can leverage pg_trgm indexes (if present).
                    qb.where("users.username ILIKE :q", { q })
                        .orWhere("users.name ILIKE :q", { q })
                        .orWhere("roles.display_name ILIKE :q", { q })
                        .orWhere("roles.roles_name ILIKE :q", { q })
                        .orWhere("branch.branch_name ILIKE :q", { q });
                })
            );
        }

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

        return query;
    }

    async findAll(
        filters?: { role?: string; q?: string; status?: "active" | "inactive" },
        access?: AccessContext,
        sortCreated: CreatedSort = "old"
    ): Promise<Users[]> {
        try {
            const query = this.buildFindAllQuery(filters, access, sortCreated);
            return await query.getMany();
        } catch (error) {
            throw error
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
            const safePage = Math.max(page, 1);
            const safeLimit = Math.min(Math.max(limit, 1), 200);
            const query = this.buildFindAllQuery(filters, access, sortCreated);
            query.skip((safePage - 1) * safeLimit).take(safeLimit);
            const [data, total] = await query.getManyAndCount();
            const last_page = Math.max(Math.ceil(total / safeLimit), 1);
            return { data, total, page: safePage, limit: safeLimit, last_page };
        } catch (error) {
            throw error;
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
            // If a branch context exists, force the user into that branch.
            // This is required for non-admins, and also keeps admin "switched branch" behavior consistent.
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

            // If a branch context exists and actor is NOT admin, only allow updates within that branch.
            if (ctx?.branchId && !ctx?.isAdmin) {
                const existing = await this.findOne(id);
                if (!existing) {
                    throw new Error("เนเธกเนเธเธเธเธนเนเนเธเน");
                }
                (users as any).branch_id = ctx.branchId;
            }

            // Admin: allow changing user.branch_id across branches even when admin has selected an active branch.
            // When app.branch_id is set, Postgres RLS hides rows from other branches and may block branch moves.
            // Temporarily clear the session branch context for this operation only.
            if (ctx?.branchId && ctx?.isAdmin && typeof (users as any).branch_id === "string" && (users as any).branch_id !== ctx.branchId) {
                const qr = ctx.queryRunner;
                if (qr) {
                    await qr.query("SELECT set_config('app.branch_id', '', false)");
                }
                try {
                    return await getRepository(Users).save({ ...users, id });
                } finally {
                    if (qr) {
                        await qr.query("SELECT set_config('app.branch_id', $1, false)", [ctx.branchId]);
                    }
                }
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
                    throw new Error("เนเธกเนเธเธเธเธนเนเนเธเน");
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
