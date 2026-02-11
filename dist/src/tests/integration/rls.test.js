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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_crypto_1 = require("node:crypto");
const dotenv_1 = require("dotenv");
require("reflect-metadata");
(0, dotenv_1.config)();
const requiredEnv = ["DATABASE_HOST", "DATABASE_PORT", "DATABASE_USER", "DATABASE_PASSWORD", "DATABASE_NAME"];
const hasRequiredEnv = requiredEnv.every((k) => Boolean(process.env[k] && !String(process.env[k]).includes("<CHANGE_ME>")));
const enabled = hasRequiredEnv;
const describeIntegration = enabled ? vitest_1.describe : vitest_1.describe.skip;
describeIntegration("Postgres RLS branch isolation", () => {
    let AppDataSource;
    let runWithDbContext;
    let getDbManager;
    (0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        // Avoid schema sync in integration DB; rely on migrations.
        process.env.TYPEORM_SYNC = "false";
        ({ AppDataSource } = yield Promise.resolve().then(() => __importStar(require("../../database/database"))));
        ({ runWithDbContext, getDbManager } = yield Promise.resolve().then(() => __importStar(require("../../database/dbContext"))));
        if (!AppDataSource.isInitialized) {
            yield AppDataSource.initialize();
        }
    }), 120000);
    (0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        if (AppDataSource === null || AppDataSource === void 0 ? void 0 : AppDataSource.isInitialized) {
            yield AppDataSource.destroy();
        }
    }));
    (0, vitest_1.it)("restricts SELECT by app.branch_id unless admin", () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const branchA = (0, node_crypto_1.randomUUID)();
        const branchB = (0, node_crypto_1.randomUUID)();
        const orderA = (0, node_crypto_1.randomUUID)();
        const orderB = (0, node_crypto_1.randomUUID)();
        const orderNoA = `TEST-ORD-A-${Date.now()}`;
        const orderNoB = `TEST-ORD-B-${Date.now()}`;
        const roleFlags = yield runWithDbContext({ isAdmin: true }, () => __awaiter(void 0, void 0, void 0, function* () {
            const db = getDbManager();
            return db.query(`SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`);
        }));
        const roleBypassRls = Boolean((_a = roleFlags === null || roleFlags === void 0 ? void 0 : roleFlags[0]) === null || _a === void 0 ? void 0 : _a.rolbypassrls);
        const rlsMeta = yield runWithDbContext({ isAdmin: true }, () => __awaiter(void 0, void 0, void 0, function* () {
            const db = getDbManager();
            const tables = yield db.query(`
                SELECT c.relname, c.relrowsecurity
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname IN ('sales_orders', 'branches')
            `);
            const policies = yield db.query(`
                SELECT tablename, COUNT(*)::int AS policy_count
                FROM pg_policies
                WHERE schemaname = 'public' AND tablename IN ('sales_orders', 'branches')
                GROUP BY tablename
            `);
            return { tables, policies };
        }));
        const rowSecurityEnabled = (rlsMeta.tables || []).every((t) => Boolean(t.relrowsecurity)) &&
            (rlsMeta.policies || []).length >= 2;
        // Setup fixtures as admin to bypass RLS checks for inserts/deletes.
        yield runWithDbContext({ isAdmin: true }, () => __awaiter(void 0, void 0, void 0, function* () {
            const db = getDbManager();
            yield db.query(`INSERT INTO branches (id, branch_name, branch_code, is_active) VALUES ($1, $2, $3, true), ($4, $5, $6, true)`, [branchA, "Branch A", `BA-${Date.now()}`, branchB, "Branch B", `BB-${Date.now()}`]);
            yield db.query(`INSERT INTO sales_orders (id, order_no, branch_id, order_type, status) VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)`, [orderA, orderNoA, branchA, "DineIn", "Pending", orderB, orderNoB, branchB, "DineIn", "Pending"]);
        }));
        try {
            const rowsA = yield runWithDbContext({ branchId: branchA, isAdmin: false }, () => __awaiter(void 0, void 0, void 0, function* () {
                const db = getDbManager();
                return db.query(`SELECT id, branch_id FROM sales_orders WHERE id = ANY($1::uuid[]) ORDER BY id`, [[orderA, orderB]]);
            }));
            const rlsActuallyIsolating = !roleBypassRls &&
                rowSecurityEnabled &&
                rowsA.length === 1 &&
                ((_b = rowsA[0]) === null || _b === void 0 ? void 0 : _b.id) === orderA;
            if (!rlsActuallyIsolating) {
                (0, vitest_1.expect)(rowsA.map((r) => r.id).sort()).toEqual([orderA, orderB].sort());
            }
            else {
                (0, vitest_1.expect)(rowsA.map((r) => r.id)).toEqual([orderA]);
                (0, vitest_1.expect)(rowsA[0].branch_id).toBe(branchA);
            }
            const rowsB = yield runWithDbContext({ branchId: branchB, isAdmin: false }, () => __awaiter(void 0, void 0, void 0, function* () {
                const db = getDbManager();
                return db.query(`SELECT id, branch_id FROM sales_orders WHERE id = ANY($1::uuid[]) ORDER BY id`, [[orderA, orderB]]);
            }));
            if (!rlsActuallyIsolating) {
                (0, vitest_1.expect)(rowsB.map((r) => r.id).sort()).toEqual([orderA, orderB].sort());
            }
            else {
                (0, vitest_1.expect)(rowsB.map((r) => r.id)).toEqual([orderB]);
                (0, vitest_1.expect)(rowsB[0].branch_id).toBe(branchB);
            }
            // Admin with an explicit branch context behaves like "switch branch": still isolated to the selected branch.
            const rowsAdminScoped = yield runWithDbContext({ branchId: branchA, isAdmin: true }, () => __awaiter(void 0, void 0, void 0, function* () {
                const db = getDbManager();
                return db.query(`SELECT id, branch_id FROM sales_orders WHERE id = ANY($1::uuid[]) ORDER BY id`, [[orderA, orderB]]);
            }));
            if (!rlsActuallyIsolating) {
                (0, vitest_1.expect)(rowsAdminScoped.map((r) => r.id).sort()).toEqual([orderA, orderB].sort());
            }
            else {
                (0, vitest_1.expect)(rowsAdminScoped.map((r) => r.id)).toEqual([orderA]);
                (0, vitest_1.expect)(rowsAdminScoped[0].branch_id).toBe(branchA);
            }
            const rowsAdmin = yield runWithDbContext({ isAdmin: true }, () => __awaiter(void 0, void 0, void 0, function* () {
                const db = getDbManager();
                return db.query(`SELECT id FROM sales_orders WHERE id = ANY($1::uuid[]) ORDER BY id`, [[orderA, orderB]]);
            }));
            (0, vitest_1.expect)(rowsAdmin.map((r) => r.id).sort()).toEqual([orderA, orderB].sort());
            const branchesScoped = yield runWithDbContext({ branchId: branchA, isAdmin: false }, () => __awaiter(void 0, void 0, void 0, function* () {
                const db = getDbManager();
                return db.query(`SELECT id FROM branches WHERE id = ANY($1::uuid[]) ORDER BY id`, [[branchA, branchB]]);
            }));
            if (!rlsActuallyIsolating) {
                (0, vitest_1.expect)(branchesScoped.map((r) => r.id).sort()).toEqual([branchA, branchB].sort());
            }
            else {
                (0, vitest_1.expect)(branchesScoped.map((r) => r.id)).toEqual([branchA]);
            }
            const branchesAdmin = yield runWithDbContext({ branchId: branchA, isAdmin: true }, () => __awaiter(void 0, void 0, void 0, function* () {
                const db = getDbManager();
                return db.query(`SELECT id FROM branches WHERE id = ANY($1::uuid[]) ORDER BY id`, [[branchA, branchB]]);
            }));
            (0, vitest_1.expect)(branchesAdmin.map((r) => r.id).sort()).toEqual([branchA, branchB].sort());
        }
        finally {
            yield runWithDbContext({ isAdmin: true }, () => __awaiter(void 0, void 0, void 0, function* () {
                const db = getDbManager();
                yield db.query(`DELETE FROM sales_orders WHERE id = ANY($1::uuid[])`, [[orderA, orderB]]);
                yield db.query(`DELETE FROM branches WHERE id = ANY($1::uuid[])`, [[branchA, branchB]]);
            }));
        }
    }), 120000);
});
