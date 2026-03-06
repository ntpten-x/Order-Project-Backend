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
import { PrintSettings } from "../entity/pos/PrintSettings"
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
dotenv.config()
const isProd = process.env.NODE_ENV === "production"
const rawTypeormLogging = (process.env.TYPEORM_LOGGING || "").trim().toLowerCase()
const requestedSynchronize = process.env.TYPEORM_SYNC
    ? process.env.TYPEORM_SYNC === "true"
    : !isProd
const dbUser = (process.env.DATABASE_USER || "").toLowerCase()
const syncWithNonOwnerOverride = process.env.ALLOW_TYPEORM_SYNC_WITH_NON_OWNER === "1"
const likelyNonOwnerDbRole = dbUser !== "" && dbUser !== "postgres"
const synchronize = requestedSynchronize && (!likelyNonOwnerDbRole || syncWithNonOwnerOverride)
const useSsl = process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "1"
const enforceDbRolePolicy = process.env.ENFORCE_DB_ROLE_POLICY !== "0"
const allowSuperuserDbRole = process.env.ALLOW_SUPERUSER_DB_ROLE === "1"
const allowBypassRlsRole = process.env.ALLOW_BYPASSRLS === "1"
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

function resolveTypeormLogging():
    | boolean
    | Array<"query" | "error" | "schema" | "warn" | "info" | "log" | "migration"> {
    if (!rawTypeormLogging) {
        // Keep production on error-only and avoid noisy query logging elsewhere by default.
        return isProd ? ["error"] : false
    }

    if (["1", "true", "all", "full"].includes(rawTypeormLogging)) {
        return true
    }

    if (["0", "false", "off", "none"].includes(rawTypeormLogging)) {
        return false
    }

    const explicitLevels = rawTypeormLogging
        .split(",")
        .map((token) => token.trim())
        .filter((token): token is "query" | "error" | "schema" | "warn" | "info" | "log" | "migration" =>
            ["query", "error", "schema", "warn", "info", "log", "migration"].includes(token)
        )

    if (explicitLevels.length > 0) {
        return explicitLevels
    }

    return isProd ? ["error"] : false
}

const typeormLogging = resolveTypeormLogging()

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: [Users, Roles, Branch, IngredientsUnit, Ingredients, PurchaseOrder, StockOrdersItem, StockOrdersDetail, SalesOrder, SalesOrderItem, SalesOrderDetail, Category, Products, ProductsUnit, Tables, Delivery, Discounts, Payments, PaymentMethod, Shifts, ShopProfile, ShopPaymentAccount, PrintSettings, SalesSummaryView, TopSellingItemsView, OrderQueue, AuditLog, PermissionResource, PermissionAction, RolePermission, UserPermission, PermissionAudit, PermissionOverrideApproval],
    synchronize: synchronize as boolean,
    logging: typeormLogging,
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
        if (enforceDbRolePolicy && dbUser === "postgres" && !allowSuperuserDbRole) {
            throw new Error(
                "[DB] DATABASE_USER=postgres is blocked by DB role policy. Use a dedicated app role (NOSUPERUSER + NOBYPASSRLS)."
            )
        }

        await AppDataSource.initialize()
        console.log("Database connected successfully")

        // Operational safety checks for multi-tenant RLS deployments
        const isProdEnv = process.env.NODE_ENV === "production"

        // 1) Enforce app DB role hardening (NOSUPERUSER + NOBYPASSRLS) in every environment.
        // Emergency overrides are intentionally explicit and off by default.
        if (enforceDbRolePolicy) {
            const roleRows = await AppDataSource.query(
                `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`
            )
            const role = roleRows?.[0]
            if (!role) {
                throw new Error("[DB] Unable to resolve current DB role for policy enforcement.")
            }

            const roleName = String(role.rolname ?? "")
            const isSuperuser = Boolean(role.rolsuper)
            const hasBypassRls = Boolean(role.rolbypassrls)

            if (isSuperuser && !allowSuperuserDbRole) {
                throw new Error(
                    `[DB] Role policy violation: current role "${roleName}" is SUPERUSER. Use a dedicated app role with NOSUPERUSER.`
                )
            }

            if (hasBypassRls && !allowBypassRlsRole) {
                throw new Error(
                    `[DB] Role policy violation: current role "${roleName}" has BYPASSRLS. Use NOBYPASSRLS to keep tenant isolation effective.`
                )
            }
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
