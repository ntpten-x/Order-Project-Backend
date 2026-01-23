import "reflect-metadata"
import { DataSource } from "typeorm"
import path from "path"
import { Users } from "../entity/Users"
import { Roles } from "../entity/Roles"
import { IngredientsUnit } from "../entity/stock/IngredientsUnit"
import { Ingredients } from "../entity/stock/Ingredients"
// Stock entities (with alias to avoid conflict)
// Stock entities
import { PurchaseOrder } from "../entity/stock/PurchaseOrder"
import { StockOrdersItem } from "../entity/stock/OrdersItem"
import { StockOrdersDetail } from "../entity/stock/OrdersDetail"
// POS entities
import { SalesOrder } from "../entity/pos/SalesOrder"
import { SalesOrderItem } from "../entity/pos/SalesOrderItem"
import { SalesOrderDetail } from "../entity/pos/SalesOrderDetail"
import { Category } from "../entity/pos/Category"
import { Products } from "../entity/pos/Products"
import { ProductsUnit } from "../entity/pos/ProductsUnit"
import { Tables } from "../entity/pos/Tables"
import { Delivery } from "../entity/pos/Delivery"
import { Discounts } from "../entity/pos/Discounts"
import { Payments } from "../entity/pos/Payments"
import { PaymentMethod } from "../entity/pos/PaymentMethod"
import { ShopProfile } from "../entity/pos/ShopProfile"
import { SalesSummaryView } from "../entity/pos/views/SalesSummaryView"
import { TopSellingItemsView } from "../entity/pos/views/TopSellingItemsView"

import { Shifts } from "../entity/pos/Shifts"
import * as dotenv from "dotenv"
dotenv.config()
const isProd = process.env.NODE_ENV === "production"
const synchronize = process.env.TYPEORM_SYNC
    ? process.env.TYPEORM_SYNC === "true"
    : !isProd
const useSsl = process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "1"
const sslOptions = useSsl
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" }
    : false

const poolSize = Number(process.env.DATABASE_POOL_MAX || 10)
const connectionTimeoutMillis = Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 5000)
const statementTimeout = Number(process.env.STATEMENT_TIMEOUT_MS || 30000)
const migrationsDir = path.join(__dirname, "../migrations/*.{ts,js}")
export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: [Users, Roles, IngredientsUnit, Ingredients, PurchaseOrder, StockOrdersItem, StockOrdersDetail, SalesOrder, SalesOrderItem, SalesOrderDetail, Category, Products, ProductsUnit, Tables, Delivery, Discounts, Payments, PaymentMethod, Shifts, ShopProfile, SalesSummaryView, TopSellingItemsView],
    synchronize,
    logging: false,
    ssl: sslOptions,
    migrations: [migrationsDir],
    poolSize,
    extra: {
        max: poolSize,
        connectionTimeoutMillis,
        statement_timeout: statementTimeout,
        application_name: "order-project-backend"
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
