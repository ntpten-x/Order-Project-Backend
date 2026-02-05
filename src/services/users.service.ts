import { Users } from "../entity/Users";
import { UsersModels } from "../models/users.model";
import * as bcrypt from 'bcrypt'
import { SocketService } from "./socket.service";
import { RealtimeEvents } from "../utils/realtimeEvents";

export class UsersService {
    private socketService = SocketService.getInstance();

    constructor(private usersModel: UsersModels) { }

    async findAll(filters?: { role?: string }): Promise<Users[]> {
        try {
            return this.usersModel.findAll(filters)
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
                throw new Error("มีชื่อผู้ใช้ " + users.username + " อยู่ในระบบแล้ว")
            }
            users.password = await bcrypt.hash(users.password, 10)
            await this.usersModel.create(users)
            const createdUser = await this.usersModel.findOneByUsername(users.username)
            this.socketService.emitToRole('Admin', RealtimeEvents.users.create, createdUser)
            return createdUser!
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
            if (users.username && findUser.username !== users.username) {
                const findUserByUsername = await this.usersModel.findOneByUsername(users.username)
                if (findUserByUsername) {
                    throw new Error("มีชื่อผู้ใช้ " + users.username + " อยู่ในระบบแล้ว")
                }
            }
            await this.usersModel.update(id, users)
            const updatedUser = await this.usersModel.findOne(id)
            this.socketService.emitToRole('Admin', RealtimeEvents.users.update, updatedUser)
            return updatedUser!
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.usersModel.delete(id)
            this.socketService.emitToRole('Admin', RealtimeEvents.users.delete, { id })
        } catch (error) {
            throw error
        }
    }
}
