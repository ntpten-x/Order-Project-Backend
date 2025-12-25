import { AppDataSource } from "../database/database";
import { Roles } from "../entity/Roles";

export class RolesModels {
    private rolesRepository = AppDataSource.getRepository(Roles)

    async findAll(): Promise<Roles[]> {
        try {
            return this.rolesRepository.createQueryBuilder("roles").getMany()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Roles | null> {
        try {
            return this.rolesRepository.createQueryBuilder("roles").where("roles.id = :id", { id }).getOne()
        } catch (error) {
            throw error
        }
    }

    async create(data: Roles): Promise<Roles> {
        try {
            return this.rolesRepository.createQueryBuilder("roles").insert().values(data).returning("id").execute().then((result) => result.raw[0])
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Roles): Promise<Roles> {
        try {
            return this.rolesRepository.createQueryBuilder("roles").update(data).where("roles.id = :id", { id }).returning("id").execute().then((result) => result.raw[0])
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            this.rolesRepository.createQueryBuilder("roles").delete().where("roles.id = :id", { id }).execute()
        } catch (error) {
            throw error
        }
    }
}