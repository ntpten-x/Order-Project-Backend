import "reflect-metadata"
import { DataSource } from "typeorm"
import { Users } from "../entity/Users"
import { Roles } from "../entity/Roles"
import { IngredientsUnit } from "../entity/stock/IngredientsUnit"
import { Ingredients } from "../entity/stock/Ingredients"
import { Orders } from "../entity/pos/Orders"
import { OrdersItem } from "../entity/pos/OrdersItem"
import { OrdersDetail } from "../entity/pos/OrdersDetail"
import { Category } from "../entity/pos/Category"
import { Products } from "../entity/pos/Products"
import { ProductsUnit } from "../entity/pos/ProductsUnit"
import { Tables } from "../entity/pos/Tables"
import { Delivery } from "../entity/pos/Delivery"
import { Discounts } from "../entity/pos/Discounts"
import { Payments } from "../entity/pos/Payments"
import { PaymentMethod } from "../entity/pos/PaymentMethod"
import { PaymentDetails } from "../entity/pos/PaymentDetails"
import * as dotenv from "dotenv"
dotenv.config()
export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: [Users, Roles, IngredientsUnit, Ingredients, Orders, OrdersItem, OrdersDetail, Category, Products, ProductsUnit, Tables, Delivery, Discounts, Payments, PaymentMethod, PaymentDetails],
    synchronize: true,
    logging: false,
    ssl: {
        rejectUnauthorized: false
    }
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