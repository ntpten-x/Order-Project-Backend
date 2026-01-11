import { AppDataSource } from "../database/database";
import { Users } from "../entity/Users";

export class UsersModels {
    private usersRepository = AppDataSource.getRepository(Users)

    async findAll(filters?: { role?: string }): Promise<Users[]> {
        try {
            const query = this.usersRepository.createQueryBuilder("users")
                .leftJoinAndSelect("users.roles", "roles")
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
            return this.usersRepository.createQueryBuilder("users")
                .leftJoinAndSelect("users.roles", "roles")
                .where("users.id = :id", { id })
                .getOne()
        } catch (error) {
            throw error
        }
    }

    async findOneByUsername(username: string): Promise<Users | null> {
        try {
            return this.usersRepository.createQueryBuilder("users")
                .leftJoinAndSelect("users.roles", "roles")
                .where("users.username = :username", { username })
                .getOne()
        } catch (error) {
            throw error
        }
    }

    async create(users: Users): Promise<Users> {
        try {
            return this.usersRepository.save(users)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, users: Users): Promise<Users> {
        try {
            return this.usersRepository.save({ ...users, id })
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.usersRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}