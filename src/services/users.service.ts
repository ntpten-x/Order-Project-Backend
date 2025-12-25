import { Users } from "../entity/Users";
import { UsersModels } from "../models/users.model";
import * as bcrypt from 'bcrypt'
export class UsersService {
    constructor(private usersModel: UsersModels) { }

    async findAll(): Promise<Users[]> {
        try {
            return this.usersModel.findAll()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Users | null> {
        try {
            return this.usersModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async create(users: Users): Promise<Users> {
        try {
            const findUser = await this.usersModel.findOneByUsername(users.username)
            if (findUser) {
                throw new Error("ผู้ใช้ชื่อ " + users.username + " ถูกใช้แล้ว")
            }
            users.password = await bcrypt.hash(users.password, 10)
            return this.usersModel.create(users)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, users: Users): Promise<Users> {
        try {
            const findUser = await this.usersModel.findOne(id)
            if (!findUser) {
                throw new Error("ไม่พบผู้ใช้")
            }
            if (users.password) {
                users.password = await bcrypt.hash(users.password, 10)
            }
            if (findUser.username !== users.username) {
                const findUserByUsername = await this.usersModel.findOneByUsername(users.username)
                if (findUserByUsername) {
                    throw new Error("ผู้ใช้ชื่อ " + users.username + " ถูกใช้แล้ว")
                }
            }
            return this.usersModel.update(id, users)
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            return this.usersModel.delete(id)
        } catch (error) {
            throw error
        }
    }
}