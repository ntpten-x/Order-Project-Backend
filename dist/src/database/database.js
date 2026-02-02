"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = exports.AppDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const path_1 = __importDefault(require("path"));
const Users_1 = require("../entity/Users");
const Roles_1 = require("../entity/Roles");
const Branch_1 = require("../entity/Branch");
const IngredientsUnit_1 = require("../entity/stock/IngredientsUnit");
const Ingredients_1 = require("../entity/stock/Ingredients");
// Stock entities (with alias to avoid conflict)
// Stock entities
const PurchaseOrder_1 = require("../entity/stock/PurchaseOrder");
const OrdersItem_1 = require("../entity/stock/OrdersItem");
const OrdersDetail_1 = require("../entity/stock/OrdersDetail");
// POS entities
const SalesOrder_1 = require("../entity/pos/SalesOrder");
const SalesOrderItem_1 = require("../entity/pos/SalesOrderItem");
const SalesOrderDetail_1 = require("../entity/pos/SalesOrderDetail");
const Category_1 = require("../entity/pos/Category");
const Products_1 = require("../entity/pos/Products");
const ProductsUnit_1 = require("../entity/pos/ProductsUnit");
const Tables_1 = require("../entity/pos/Tables");
const Delivery_1 = require("../entity/pos/Delivery");
const Discounts_1 = require("../entity/pos/Discounts");
const Payments_1 = require("../entity/pos/Payments");
const PaymentMethod_1 = require("../entity/pos/PaymentMethod");
const ShopProfile_1 = require("../entity/pos/ShopProfile");
const ShopPaymentAccount_1 = require("../entity/pos/ShopPaymentAccount");
const SalesSummaryView_1 = require("../entity/pos/views/SalesSummaryView");
const TopSellingItemsView_1 = require("../entity/pos/views/TopSellingItemsView");
const Shifts_1 = require("../entity/pos/Shifts");
const OrderQueue_1 = require("../entity/pos/OrderQueue");
const Promotions_1 = require("../entity/pos/Promotions");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const isProd = process.env.NODE_ENV === "production";
const synchronize = process.env.TYPEORM_SYNC
    ? process.env.TYPEORM_SYNC === "true"
    : !isProd;
const useSsl = process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "1";
const sslOptions = useSsl
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true" }
    : false;
// Enhanced Database Connection Pooling Configuration
const poolSize = Number(process.env.DATABASE_POOL_MAX || 20); // Increased default pool size
const minPoolSize = Number(process.env.DATABASE_POOL_MIN || 5); // Minimum connections
const connectionTimeoutMillis = Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 30000);
const statementTimeout = Number(process.env.STATEMENT_TIMEOUT_MS || 30000);
const idleTimeoutMillis = Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30000); // Close idle connections after 30s
const migrationsDir = path_1.default.join(__dirname, "../migrations/*.{ts,js}");
exports.AppDataSource = new typeorm_1.DataSource({
    type: "postgres",
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: [Users_1.Users, Roles_1.Roles, Branch_1.Branch, IngredientsUnit_1.IngredientsUnit, Ingredients_1.Ingredients, PurchaseOrder_1.PurchaseOrder, OrdersItem_1.StockOrdersItem, OrdersDetail_1.StockOrdersDetail, SalesOrder_1.SalesOrder, SalesOrderItem_1.SalesOrderItem, SalesOrderDetail_1.SalesOrderDetail, Category_1.Category, Products_1.Products, ProductsUnit_1.ProductsUnit, Tables_1.Tables, Delivery_1.Delivery, Discounts_1.Discounts, Payments_1.Payments, PaymentMethod_1.PaymentMethod, Shifts_1.Shifts, ShopProfile_1.ShopProfile, ShopPaymentAccount_1.ShopPaymentAccount, SalesSummaryView_1.SalesSummaryView, TopSellingItemsView_1.TopSellingItemsView, OrderQueue_1.OrderQueue, Promotions_1.Promotions],
    synchronize: synchronize,
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
});
const connectDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield exports.AppDataSource.initialize();
        console.log("Database connected successfully");
    }
    catch (error) {
        console.error("Error connecting to database:", error);
        process.exit(1);
    }
});
exports.connectDatabase = connectDatabase;
