import { AppDataSource } from "../database/database";
import { Users } from "../entity/Users";

export class UsersModels {
    private usersRepository = AppDataSource.getRepository(Users)

    async findAll(): Promise<Users[]> {
        try {
            return this.usersRepository.createQueryBuilder("users")
                .leftJoinAndSelect("users.roles", "roles")
                .getMany()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: number): Promise<Users | null> {
        try {
            return this.usersRepository.createQueryBuilder("users")
                .leftJoinAndSelect("users.roles", "roles")
                .where("users.id = :id", { id })
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

    async update(id: number, users: Users): Promise<Users> {
        try {
            return this.usersRepository.save({ ...users, id })
        } catch (error) {
            throw error
        }
    }

    async delete(id: number): Promise<void> {
        try {
            await this.usersRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}