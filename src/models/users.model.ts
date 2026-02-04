import { Users } from "../entity/Users";
import { getDbContext, getRepository } from "../database/dbContext";

export class UsersModels {
    async findAll(filters?: { role?: string }): Promise<Users[]> {
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

            return await query.getMany();
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Users | null> {
        try {
            const ctx = getDbContext();
            const query = getRepository(Users).createQueryBuilder("users")
                .leftJoinAndSelect("users.roles", "roles")
                .leftJoinAndSelect("users.branch", "branch")
                .where("users.id = :id", { id });

            if (ctx?.branchId) {
                query.andWhere("users.branch_id = :branchId", { branchId: ctx.branchId });
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
}
