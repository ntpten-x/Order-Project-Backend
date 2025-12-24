import { Users } from "../entity/Users";
import { UsersModels } from "../models/users.model";

export class UsersService {
    constructor(private usersModel: UsersModels) { }

    async findAll(): Promise<Users[]> {
        try {
            return this.usersModel.findAll()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: number): Promise<Users | null> {
        try {
            return this.usersModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async create(users: Users): Promise<Users> {
        try {
            return this.usersModel.create(users)
        } catch (error) {
            throw error
        }
    }

    async update(id: number, users: Users): Promise<Users> {
        try {
            return this.usersModel.update(id, users)
        } catch (error) {
            throw error
        }
    }

    async delete(id: number): Promise<void> {
        try {
            return this.usersModel.delete(id)
        } catch (error) {
            throw error
        }
    }
}