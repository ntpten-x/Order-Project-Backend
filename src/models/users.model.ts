import { Users } from "../entity/Users";
import { getRepository } from "../database/dbContext";

export class UsersModels {
    async findAll(filters?: { role?: string }): Promise<Users[]> {
        try {
            const usersRepository = getRepository(Users);
            const query = usersRepository.createQueryBuilder("users")
                .leftJoinAndSelect("users.roles", "roles")
                .leftJoinAndSelect("users.branch", "branch")
                .orderBy("users.is_active", "DESC")
                .addOrderBy("users.create_date", "ASC");

            if (filters?.role) {
                query.where("roles.roles_name = :role", { role: filters.role });
            }

            return await query.getMany();
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Users | null> {
        try {
            return getRepository(Users).createQueryBuilder("users")
                .leftJoinAndSelect("users.roles", "roles")
                .leftJoinAndSelect("users.branch", "branch")
                .where("users.id = :id", { id })
                .getOne()
        } catch (error) {
            throw error
        }
    }

    async findOneByUsername(username: string): Promise<Users | null> {
        try {
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
            return getRepository(Users).save(users)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, users: Users): Promise<Users> {
        try {
            return getRepository(Users).save({ ...users, id })
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await getRepository(Users).delete(id)
        } catch (error) {
            throw error
        }
    }
}
