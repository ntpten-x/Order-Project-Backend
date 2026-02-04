import { Roles } from "../entity/Roles";
import { getRepository } from "../database/dbContext";

export class RolesModels {
    async findAll(): Promise<Roles[]> {
        try {
            return getRepository(Roles).createQueryBuilder("roles")
                .orderBy("roles.create_date", "ASC")
                .getMany()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Roles | null> {
        try {
            return getRepository(Roles).createQueryBuilder("roles").where("roles.id = :id", { id }).getOne()
        } catch (error) {
            throw error
        }
    }

    async create(data: Roles): Promise<Roles> {
        try {
            return getRepository(Roles).createQueryBuilder("roles").insert().values(data).returning("id").execute().then((result) => result.raw[0])
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Roles): Promise<Roles> {
        try {
            return getRepository(Roles).createQueryBuilder("roles").update(data).where("roles.id = :id", { id }).returning("id").execute().then((result) => result.raw[0])
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            getRepository(Roles).createQueryBuilder("roles").delete().where("roles.id = :id", { id }).execute()
        } catch (error) {
            throw error
        }
    }
}
