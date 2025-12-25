import { Roles } from "../entity/Roles"
import { RolesModels } from "../models/roles.model"

export class RolesService {
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
            return this.rolesModels.create(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Roles): Promise<Roles> {
        try {
            return this.rolesModels.update(id, data)
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            this.rolesModels.delete(id)
        } catch (error) {
            throw error
        }
    }
}