import { Roles } from "../entity/Roles"
import { RolesModels } from "../models/roles.model"

import { SocketService } from "./socket.service"
import { RealtimeEvents } from "../utils/realtimeEvents"

export class RolesService {
    private socketService = SocketService.getInstance();

    constructor(private rolesModels: RolesModels) { }

    async findAll(): Promise<Roles[]> {
        try {
            return this.rolesModels.findAll()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Roles | null> {
        try {
            return this.rolesModels.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async create(data: Roles): Promise<Roles> {
        try {
            // @ts-ignore - model returns {id} essentially
            const savedRole = await this.rolesModels.create(data)
            const createdRole = await this.rolesModels.findOne(savedRole.id)
            if (createdRole) {
                this.socketService.emitToRole('Admin', RealtimeEvents.roles.create, createdRole)
                return createdRole
            }
            return savedRole
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Roles): Promise<Roles> {
        try {
            await this.rolesModels.update(id, data)
            const updatedRole = await this.rolesModels.findOne(id)
            if (updatedRole) {
                this.socketService.emitToRole('Admin', RealtimeEvents.roles.update, updatedRole)
                return updatedRole
            }
            throw new Error("ไม่พบข้อมูลบทบาท")
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.rolesModels.delete(id)
            this.socketService.emitToRole('Admin', RealtimeEvents.roles.delete, { id })
        } catch (error) {
            throw error
        }
    }
}
