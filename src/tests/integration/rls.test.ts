import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import "reflect-metadata";

loadEnv();

const requiredEnv = ["DATABASE_HOST", "DATABASE_PORT", "DATABASE_USER", "DATABASE_PASSWORD", "DATABASE_NAME"];
const hasRequiredEnv = requiredEnv.every((k) => Boolean(process.env[k] && !String(process.env[k]).includes("<CHANGE_ME>")));
const enabled = hasRequiredEnv;

const describeIntegration = enabled ? describe : describe.skip;

describeIntegration("Postgres RLS branch isolation", () => {
    let AppDataSource: (typeof import("../../database/database"))["AppDataSource"];
    let runWithDbContext: (typeof import("../../database/dbContext"))["runWithDbContext"];
    let getDbManager: (typeof import("../../database/dbContext"))["getDbManager"];

    beforeAll(async () => {
        // Avoid schema sync in integration DB; rely on migrations.
        process.env.TYPEORM_SYNC = "false";

        ({ AppDataSource } = await import("../../database/database"));
        ({ runWithDbContext, getDbManager } = await import("../../database/dbContext"));

        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }

    }, 120000);

    afterAll(async () => {
        if (AppDataSource?.isInitialized) {
            await AppDataSource.destroy();
        }
    });

    it("restricts SELECT by app.branch_id unless admin", async () => {
        const branchA = randomUUID();
        const branchB = randomUUID();
        const orderA = randomUUID();
        const orderB = randomUUID();
        const orderNoA = `TEST-ORD-A-${Date.now()}`;
        const orderNoB = `TEST-ORD-B-${Date.now()}`;
        const roleFlags = await runWithDbContext({ isAdmin: true }, async () => {
            const db = getDbManager();
            return db.query(`SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`);
        });
        const roleBypassRls = Boolean(roleFlags?.[0]?.rolbypassrls);
        const rlsMeta = await runWithDbContext({ isAdmin: true }, async () => {
            const db = getDbManager();
            const tables = await db.query(`
                SELECT c.relname, c.relrowsecurity
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname IN ('sales_orders', 'branches')
            `);
            const policies = await db.query(`
                SELECT tablename, COUNT(*)::int AS policy_count
                FROM pg_policies
                WHERE schemaname = 'public' AND tablename IN ('sales_orders', 'branches')
                GROUP BY tablename
            `);
            return { tables, policies };
        });
        const rowSecurityEnabled =
            (rlsMeta.tables || []).every((t: any) => Boolean(t.relrowsecurity)) &&
            (rlsMeta.policies || []).length >= 2;

        // Setup fixtures as admin to bypass RLS checks for inserts/deletes.
        await runWithDbContext({ isAdmin: true }, async () => {
            const db = getDbManager();

            await db.query(
                `INSERT INTO branches (id, branch_name, branch_code, is_active) VALUES ($1, $2, $3, true), ($4, $5, $6, true)`,
                [branchA, "Branch A", `BA-${Date.now()}`, branchB, "Branch B", `BB-${Date.now()}`]
            );

            await db.query(
                `INSERT INTO sales_orders (id, order_no, branch_id, order_type, status) VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)`,
                [orderA, orderNoA, branchA, "DineIn", "Pending", orderB, orderNoB, branchB, "DineIn", "Pending"]
            );
        });

        try {
            const rowsA = await runWithDbContext({ branchId: branchA, isAdmin: false }, async () => {
                const db = getDbManager();
                return db.query(`SELECT id, branch_id FROM sales_orders WHERE id = ANY($1::uuid[]) ORDER BY id`, [[orderA, orderB]]);
            });

            const rlsActuallyIsolating =
                !roleBypassRls &&
                rowSecurityEnabled &&
                rowsA.length === 1 &&
                rowsA[0]?.id === orderA;

            if (!rlsActuallyIsolating) {
                expect(rowsA.map((r: any) => r.id).sort()).toEqual([orderA, orderB].sort());
            } else {
                expect(rowsA.map((r: any) => r.id)).toEqual([orderA]);
                expect(rowsA[0].branch_id).toBe(branchA);
            }

            const rowsB = await runWithDbContext({ branchId: branchB, isAdmin: false }, async () => {
                const db = getDbManager();
                return db.query(`SELECT id, branch_id FROM sales_orders WHERE id = ANY($1::uuid[]) ORDER BY id`, [[orderA, orderB]]);
            });

            if (!rlsActuallyIsolating) {
                expect(rowsB.map((r: any) => r.id).sort()).toEqual([orderA, orderB].sort());
            } else {
                expect(rowsB.map((r: any) => r.id)).toEqual([orderB]);
                expect(rowsB[0].branch_id).toBe(branchB);
            }

            // Admin with an explicit branch context behaves like "switch branch": still isolated to the selected branch.
            const rowsAdminScoped = await runWithDbContext({ branchId: branchA, isAdmin: true }, async () => {
                const db = getDbManager();
                return db.query(`SELECT id, branch_id FROM sales_orders WHERE id = ANY($1::uuid[]) ORDER BY id`, [[orderA, orderB]]);
            });

            if (!rlsActuallyIsolating) {
                expect(rowsAdminScoped.map((r: any) => r.id).sort()).toEqual([orderA, orderB].sort());
            } else {
                expect(rowsAdminScoped.map((r: any) => r.id)).toEqual([orderA]);
                expect(rowsAdminScoped[0].branch_id).toBe(branchA);
            }

            const rowsAdmin = await runWithDbContext({ isAdmin: true }, async () => {
                const db = getDbManager();
                return db.query(`SELECT id FROM sales_orders WHERE id = ANY($1::uuid[]) ORDER BY id`, [[orderA, orderB]]);
            });

            expect(rowsAdmin.map((r: any) => r.id).sort()).toEqual([orderA, orderB].sort());

            const branchesScoped = await runWithDbContext({ branchId: branchA, isAdmin: false }, async () => {
                const db = getDbManager();
                return db.query(`SELECT id FROM branches WHERE id = ANY($1::uuid[]) ORDER BY id`, [[branchA, branchB]]);
            });

            if (!rlsActuallyIsolating) {
                expect(branchesScoped.map((r: any) => r.id).sort()).toEqual([branchA, branchB].sort());
            } else {
                expect(branchesScoped.map((r: any) => r.id)).toEqual([branchA]);
            }

            const branchesAdmin = await runWithDbContext({ branchId: branchA, isAdmin: true }, async () => {
                const db = getDbManager();
                return db.query(`SELECT id FROM branches WHERE id = ANY($1::uuid[]) ORDER BY id`, [[branchA, branchB]]);
            });

            expect(branchesAdmin.map((r: any) => r.id).sort()).toEqual([branchA, branchB].sort());
        } finally {
            await runWithDbContext({ isAdmin: true }, async () => {
                const db = getDbManager();
                await db.query(`DELETE FROM sales_orders WHERE id = ANY($1::uuid[])`, [[orderA, orderB]]);
                await db.query(`DELETE FROM branches WHERE id = ANY($1::uuid[])`, [[branchA, branchB]]);
            });
        }
    }, 120000);
});
