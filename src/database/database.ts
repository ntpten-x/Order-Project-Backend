import "reflect-metadata"
import { DataSource } from "typeorm"
import { Users } from "../entity/Users"
import { Roles } from "../entity/Roles"

import * as dotenv from "dotenv"
dotenv.config()
export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: [Users, Roles],
    synchronize: true,
    logging: false,
})

export const connectDatabase = async () => {
    try {
        await AppDataSource.initialize()
        console.log("Database connected successfully")
    } catch (error) {
        console.error("Error connecting to database:", error)
        process.exit(1)
    }
}