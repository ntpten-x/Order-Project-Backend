import "reflect-metadata"
import { DataSource } from "typeorm"
import path from "path"
import { Users } from "../entity/Users"
import { Roles } from "../entity/Roles"
import { Branch } from "../entity/Branch"
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
import { ShopPaymentAccount } from "../entity/pos/ShopPaymentAccount"
import { SalesSummaryView } from "../entity/pos/views/SalesSummaryView"
import { TopSellingItemsView } from "../entity/pos/views/TopSellingItemsView"

import { Shifts } from "../entity/pos/Shifts"
import { OrderQueue } from "../entity/pos/OrderQueue"
import { AuditLog } from "../entity/AuditLog"
import { PermissionResource } from "../entity/PermissionResource"
import { PermissionAction } from "../entity/PermissionAction"
import { RolePermission } from "../entity/RolePermission"
import { UserPermission } from "../entity/UserPermission"
import { PermissionAudit } from "../entity/PermissionAudit"
import { PermissionOverrideApproval } from "../entity/PermissionOverrideApproval"
import { ensureRbacDefaults } from "./rbac-defaults"
import * as dotenv from "dotenv"
const envPath = process.env.ENV_FILE || process.env.DOTENV_CONFIG_PATH
dotenv.config(envPath ? { path: envPath } : {})
const isProd = process.env.NODE_ENV === "production"
const requestedSynchronize = process.env.TYPEORM_SYNC
    ? process.env.TYPEORM_SYNC === "true"
    : !isProd
const dbUser = (process.env.DATABASE_USER || "").toLowerCase()
const syncWithNonOwnerOverride = process.env.ALLOW_TYPEORM_SYNC_WITH_NON_OWNER === "1"
const likelyNonOwnerDbRole = dbUser !== "" && dbUser !== "postgres"
const synchronize = requestedSynchronize && (!likelyNonOwnerDbRole || syncWithNonOwnerOverride)
const useSsl = process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "1"
const sslOptions = useSsl
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true" }
    : false
if (requestedSynchronize && !synchronize) {
    console.warn(
        "[DB] TYPEORM_SYNC requested but disabled for non-owner DB role. Use migrations (recommended) or set ALLOW_TYPEORM_SYNC_WITH_NON_OWNER=1 to override."
    )
}

// Enhanced Database Connection Pooling Configuration
const poolSize = Number(process.env.DATABASE_POOL_MAX || 20) // Increased default pool size
const minPoolSize = Number(process.env.DATABASE_POOL_MIN || 5) // Minimum connections
const connectionTimeoutMillis = Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 30000)
const statementTimeout = Number(process.env.STATEMENT_TIMEOUT_MS || 30000)
const idleTimeoutMillis = Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30000) // Close idle connections after 30s
const migrationsDir =
    process.env.NODE_ENV === "test"
        ? path.join(__dirname, "../migrations/*.js")
        : path.join(__dirname, "../migrations/*.{ts,js}")

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: [Users, Roles, Branch, IngredientsUnit, Ingredients, PurchaseOrder, StockOrdersItem, StockOrdersDetail, SalesOrder, SalesOrderItem, SalesOrderDetail, Category, Products, ProductsUnit, Tables, Delivery, Discounts, Payments, PaymentMethod, Shifts, ShopProfile, ShopPaymentAccount, SalesSummaryView, TopSellingItemsView, OrderQueue, AuditLog, PermissionResource, PermissionAction, RolePermission, UserPermission, PermissionAudit, PermissionOverrideApproval],
    synchronize: synchronize as boolean,
    logging: isProd ? ["error"] : true,
    ssl: sslOptions,
    migrations: [migrationsDir],
    poolSize,
    extra: {
        max: poolSize,
        min: minPoolSize,
        connectionTimeoutMillis,
        idleTimeoutMillis,
        statement_timeout: statementTimeout,
        application_name: "order-project-backend",
        // Connection pool optimization
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        // Query optimization
        query_timeout: statementTimeout,
        // Connection retry
        retry: {
            max: 3,
            match: [
                /ETIMEDOUT/,
                /EHOSTUNREACH/,
                /ECONNRESET/,
                /ECONNREFUSED/,
                /ETIMEDOUT/,
                /ESOCKETTIMEDOUT/,
                /EHOSTUNREACH/,
                /EPIPE/,
                /EAI_AGAIN/,
                /SequelizeConnectionError/,
                /SequelizeConnectionRefusedError/,
                /SequelizeHostNotFoundError/,
                /SequelizeHostNotReachableError/,
                /SequelizeInvalidConnectionError/,
                /SequelizeConnectionTimedOutError/
            ]
        }
    }
})

export const connectDatabase = async () => {
    try {
        await AppDataSource.initialize()
        console.log("Database connected successfully")

        // Operational safety checks for multi-tenant RLS deployments
        const isProdEnv = process.env.NODE_ENV === "production"

        // 1) Prevent silent RLS bypass at the DB role level
        try {
            const bypassRows = await AppDataSource.query(
                `SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`
            )
            const bypass = Boolean(bypassRows?.[0]?.rolbypassrls)
            if (bypass && process.env.ALLOW_BYPASSRLS !== "1") {
                const msg =
                    "[DB] Current DB role has BYPASSRLS enabled. This can disable branch isolation. Remove BYPASSRLS or set ALLOW_BYPASSRLS=1 to override."
                if (isProdEnv) {
                    throw new Error(msg)
                } else {
                    console.warn(msg)
                }
            }
        } catch (error) {
            console.warn("[DB] Failed to check BYPASSRLS:", error)
        }

        // 2) Ensure migrations are applied (optional auto-run)
        const runOnStart = process.env.RUN_MIGRATIONS_ON_START === "true"
        const requireNoPending = process.env.REQUIRE_NO_PENDING_MIGRATIONS
            ? process.env.REQUIRE_NO_PENDING_MIGRATIONS === "true"
            : isProdEnv

        if (runOnStart) {
            const ran = await AppDataSource.runMigrations()
            console.log(`[DB] Migrations applied on start: ${ran.length}`)
        } else if (requireNoPending) {
            const hasPending = await AppDataSource.showMigrations()
            if (hasPending) {
                throw new Error(
                    "[DB] Pending migrations detected. Run `npm run migration:run` (or set RUN_MIGRATIONS_ON_START=true)."
                )
            }
        }

        const runRbacBootstrap = process.env.RUN_RBAC_BASELINE_ON_START !== "false"
        if (runRbacBootstrap) {
            await ensureRbacDefaults(AppDataSource)
            console.log("[DB] RBAC baseline ensured")
        }

    } catch (error) {
        console.error("Error connecting to database:", error)
        process.exit(1)
    }
}
