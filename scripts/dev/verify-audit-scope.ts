import { AppDataSource } from "../../src/database/database";
import { Branch } from "../../src/entity/Branch";
import { Users } from "../../src/entity/Users";
import { Roles } from "../../src/entity/Roles";
import { AuditLog } from "../../src/entity/AuditLog";
import { PermissionResource } from "../../src/entity/PermissionResource";
import { PermissionAction } from "../../src/entity/PermissionAction";
import { UserPermission } from "../../src/entity/UserPermission";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { runWithDbContext } from "../../src/database/dbContext";

type Scope = "own" | "branch" | "all";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ALLOW_NONLOCAL_SEED = process.env.ALLOW_NONLOCAL_SEED === "1";

function requireEnv(name: string, value: string) {
    if (!value) {
        throw new Error(`Missing required env: ${name}`);
    }
}

function pickCookie(setCookie: string | null, key: string): string {
    if (!setCookie) return "";
    const parts = setCookie.split(/,(?=[^;]+=[^;]+)/g); // split multiple Set-Cookie headers coalesced
    for (const part of parts) {
        const m = part.match(new RegExp(`${key}=([^;]+)`));
        if (m?.[1]) return `${key}=${m[1]}`;
    }
    return "";
}

async function login(username: string, password: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ username, password }),
        redirect: "manual",
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(`Login failed (${res.status}): ${JSON.stringify(payload)}`);
    }

    const setCookie = res.headers.get("set-cookie");
    const tokenCookie = pickCookie(setCookie, "token");
    if (!tokenCookie) {
        throw new Error("Login succeeded but token cookie not found in response headers.");
    }
    return tokenCookie;
}

async function apiGet(path: string, cookie: string): Promise<{ status: number; json: any }> {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: "GET",
        headers: { accept: "application/json", cookie },
        redirect: "manual",
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
}

function assert(condition: any, message: string) {
    if (!condition) throw new Error(message);
}

function logOk(msg: string) {
    process.stdout.write(`[OK] ${msg}\n`);
}

function logInfo(msg: string) {
    process.stdout.write(`[INFO] ${msg}\n`);
}

async function ensureDb() {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
}

async function ensureRoleNonAdmin(): Promise<Roles> {
    const repo = AppDataSource.getRepository(Roles);
    const existing = await repo.find();
    const nonAdmin = existing.find((r) => r.roles_name.toLowerCase() !== "admin");
    if (nonAdmin) return nonAdmin;

    const role = repo.create({
        roles_name: "Staff",
        display_name: "Staff",
    });
    return repo.save(role);
}

async function createTestBranch(label: string): Promise<Branch> {
    const repo = AppDataSource.getRepository(Branch);
    const code = `T${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`.slice(0, 20);
    const branch = repo.create({
        branch_name: `Scope Test ${label}`,
        branch_code: code,
        is_active: true,
    });
    return repo.save(branch);
}

async function createTestUser(params: { username: string; password: string; roleId: string; branchId: string }): Promise<Users> {
    const repo = AppDataSource.getRepository(Users);
    const passwordHash = await bcrypt.hash(params.password, 10);
    const user = repo.create({
        username: params.username,
        password: passwordHash,
        roles_id: params.roleId,
        branch_id: params.branchId,
        is_use: true,
        is_active: false,
    });
    return repo.save(user);
}

async function setAuditPermissionScope(userId: string, scope: Scope) {
    const resRepo = AppDataSource.getRepository(PermissionResource);
    const actRepo = AppDataSource.getRepository(PermissionAction);
    const upRepo = AppDataSource.getRepository(UserPermission);

    const resource = await resRepo.findOneBy({ resource_key: "audit.page" });
    const action = await actRepo.findOneBy({ action_key: "view" });
    assert(resource?.id, "permission_resources missing audit.page");
    assert(action?.id, "permission_actions missing view");

    await upRepo.delete({ user_id: userId, resource_id: resource!.id, action_id: action!.id });
    await upRepo.save(
        upRepo.create({
            user_id: userId,
            resource_id: resource!.id,
            action_id: action!.id,
            effect: "allow",
            scope,
        })
    );
}

async function seedAuditLogs(params: {
    branchA: Branch;
    branchB: Branch;
    ownUser: Users;
    sameBranchOtherUser: Users;
    otherBranchUser: Users;
}) {
    const repo = AppDataSource.getRepository(AuditLog);
    const now = new Date();
    const ip = "127.0.0.1";

    const logs = [
        repo.create({
            action_type: "ORDER_UPDATE" as any,
            user_id: params.ownUser.id,
            username: params.ownUser.username,
            ip_address: ip,
            entity_type: "Orders",
            entity_id: null as any,
            branch_id: params.branchA.id,
            description: "scope_test own log",
            path: "/pos/orders",
            method: "PUT",
            created_at: new Date(now.getTime() - 5_000),
            old_values: { password: "should_redact", note: "before" } as any,
            new_values: { token: "should_redact", note: "after" } as any,
        }),
        repo.create({
            action_type: "ORDER_CREATE" as any,
            user_id: params.sameBranchOtherUser.id,
            username: params.sameBranchOtherUser.username,
            ip_address: ip,
            entity_type: "Orders",
            entity_id: null as any,
            branch_id: params.branchA.id,
            description: "scope_test same-branch other user",
            path: "/pos/orders",
            method: "POST",
            created_at: new Date(now.getTime() - 4_000),
            old_values: null as any,
            new_values: { apiKey: "should_redact" } as any,
        }),
        repo.create({
            action_type: "ORDER_DELETE" as any,
            user_id: params.otherBranchUser.id,
            username: params.otherBranchUser.username,
            ip_address: ip,
            entity_type: "Orders",
            entity_id: null as any,
            branch_id: params.branchB.id,
            description: "scope_test other-branch log",
            path: "/pos/orders",
            method: "DELETE",
            created_at: new Date(now.getTime() - 3_000),
            old_values: { refresh_token: "should_redact" } as any,
            new_values: null as any,
        }),
    ];

    const saved = await repo.save(logs);
    return {
        ownLogId: saved[0].id,
        sameBranchOtherLogId: saved[1].id,
        otherBranchLogId: saved[2].id,
    };
}

function countMatching(logs: any[], predicate: (x: any) => boolean): number {
    return logs.filter(predicate).length;
}

async function verifyOwnScope(cookie: string, ids: { ownUserId: string; otherUserId: string; branchBId: string; ownLogId: string; otherLogId: string }) {
    // 1) Default list: only own logs.
    const list = await apiGet("/audit/logs?search=scope_test&limit=50", cookie);
    assert(list.status === 200, `own: expected 200, got ${list.status}`);
    assert(list.json?.success === true, "own: expected success=true");
    const logs = list.json.data as any[];
    assert(countMatching(logs, (l) => l.user_id === ids.ownUserId) >= 1, "own: missing own logs");
    assert(countMatching(logs, (l) => l.user_id === ids.otherUserId) === 0, "own: leaked other user's logs");
    logOk("scope=own list is restricted to own user_id");

    // 2) Attempt to override user_id in query: should still be own only.
    const listOverrideUser = await apiGet(`/audit/logs?search=scope_test&limit=50&user_id=${ids.otherUserId}`, cookie);
    assert(listOverrideUser.status === 200, `own override user_id: expected 200, got ${listOverrideUser.status}`);
    const logs2 = listOverrideUser.json.data as any[];
    assert(countMatching(logs2, (l) => l.user_id === ids.otherUserId) === 0, "own: user_id override leaked other user's logs");
    logOk("scope=own ignores user_id query override");

    // 3) Attempt to request other branch: forbidden.
    const branchOverride = await apiGet(`/audit/logs?branch_id=${ids.branchBId}`, cookie);
    assert(branchOverride.status === 403, `own override branch_id: expected 403, got ${branchOverride.status}`);
    logOk("scope=own forbids requesting other branch_id");

    // 4) Detail access: own log OK, other log forbidden.
    const detailOwn = await apiGet(`/audit/logs/${ids.ownLogId}`, cookie);
    assert(detailOwn.status === 200, `own detail: expected 200, got ${detailOwn.status}`);
    const detailOther = await apiGet(`/audit/logs/${ids.otherLogId}`, cookie);
    assert(detailOther.status === 403, `own detail(other): expected 403, got ${detailOther.status}`);
    logOk("scope=own detail endpoint enforces target scope");
}

async function verifyBranchScope(cookie: string, ids: { branchAId: string; branchBId: string; ownUserId: string; otherUserSameBranchId: string; otherBranchUserId: string; branchOtherLogId: string; otherBranchLogId: string }) {
    const list = await apiGet("/audit/logs?search=scope_test&limit=50", cookie);
    assert(list.status === 200, `branch: expected 200, got ${list.status}`);
    const logs = list.json.data as any[];
    assert(countMatching(logs, (l) => l.branch_id === ids.branchAId) >= 2, "branch: missing same-branch logs");
    assert(countMatching(logs, (l) => l.branch_id === ids.branchBId) === 0, "branch: leaked other-branch logs");
    logOk("scope=branch list is restricted to actor branch_id");

    const branchOverride = await apiGet(`/audit/logs?branch_id=${ids.branchBId}`, cookie);
    assert(branchOverride.status === 403, `branch override: expected 403, got ${branchOverride.status}`);
    logOk("scope=branch forbids requesting other branch_id");

    const filterOtherSameBranch = await apiGet(`/audit/logs?limit=50&user_id=${ids.otherUserSameBranchId}&search=scope_test`, cookie);
    assert(filterOtherSameBranch.status === 200, `branch filter user: expected 200, got ${filterOtherSameBranch.status}`);
    const logs2 = filterOtherSameBranch.json.data as any[];
    assert(countMatching(logs2, (l) => l.user_id === ids.otherUserSameBranchId) >= 1, "branch: expected logs for requested same-branch user_id");
    logOk("scope=branch allows filtering by user_id within branch");

    const filterOtherBranchUser = await apiGet(`/audit/logs?limit=50&user_id=${ids.otherBranchUserId}&search=scope_test`, cookie);
    assert(filterOtherBranchUser.status === 200, `branch filter other-branch user: expected 200, got ${filterOtherBranchUser.status}`);
    const logs3 = filterOtherBranchUser.json.data as any[];
    assert(logs3.length === 0, "branch: should not return other-branch user logs due to branch filter");
    logOk("scope=branch does not leak other branch via user_id filter");

    const detailSameBranch = await apiGet(`/audit/logs/${ids.branchOtherLogId}`, cookie);
    assert(detailSameBranch.status === 200, `branch detail same-branch: expected 200, got ${detailSameBranch.status}`);
    const detailOtherBranch = await apiGet(`/audit/logs/${ids.otherBranchLogId}`, cookie);
    assert(detailOtherBranch.status === 403, `branch detail other-branch: expected 403, got ${detailOtherBranch.status}`);
    logOk("scope=branch detail endpoint enforces target branch");
}

async function verifyAllScope(cookie: string, ids: { branchBId: string; otherBranchUserId: string; otherBranchLogId: string }) {
    const listAll = await apiGet("/audit/logs?search=scope_test&limit=50", cookie);
    assert(listAll.status === 200, `all list: expected 200, got ${listAll.status}`);
    const logs = listAll.json.data as any[];
    assert(logs.length >= 3, "all: expected to see logs across branches");
    logOk("scope=all can list across branches (no branch filter)");

    const listBranchB = await apiGet(`/audit/logs?search=scope_test&limit=50&branch_id=${ids.branchBId}`, cookie);
    assert(listBranchB.status === 200, `all branch filter: expected 200, got ${listBranchB.status}`);
    const logs2 = listBranchB.json.data as any[];
    assert(countMatching(logs2, (l) => l.branch_id === ids.branchBId) >= 1, "all: expected branch_id filter to work");
    logOk("scope=all can filter by branch_id");

    const listOtherBranchUser = await apiGet(`/audit/logs?search=scope_test&limit=50&user_id=${ids.otherBranchUserId}`, cookie);
    assert(listOtherBranchUser.status === 200, `all user filter: expected 200, got ${listOtherBranchUser.status}`);
    const logs3 = listOtherBranchUser.json.data as any[];
    assert(countMatching(logs3, (l) => l.user_id === ids.otherBranchUserId) >= 1, "all: expected user_id filter to work");
    logOk("scope=all can filter by user_id");

    const detailOtherBranch = await apiGet(`/audit/logs/${ids.otherBranchLogId}`, cookie);
    assert(detailOtherBranch.status === 200, `all detail other-branch: expected 200, got ${detailOtherBranch.status}`);
    logOk("scope=all can access detail across branches");
}

async function verifyRedactionInResponses(cookie: string) {
    const list = await apiGet("/audit/logs?search=scope_test&limit=10", cookie);
    assert(list.status === 200, `redaction list: expected 200, got ${list.status}`);
    const log = (list.json.data as any[]).find((l) => String(l.description || "").includes("scope_test"));
    assert(log, "redaction: expected at least one scope_test log");
    if (log?.new_values) {
        const serialized = JSON.stringify(log.new_values);
        assert(!serialized.includes("should_redact"), "redaction: found unredacted marker in new_values");
    }
    if (log?.old_values) {
        const serialized = JSON.stringify(log.old_values);
        assert(!serialized.includes("should_redact"), "redaction: found unredacted marker in old_values");
    }
    logOk("old_values/new_values are redacted in API responses");
}

async function explainAuditSearch() {
    const term = "scope_test";
    const explainBase = (whereSql: string) => `
        EXPLAIN
        SELECT id
        FROM audit_logs audit
        WHERE ${whereSql}
        ORDER BY audit.created_at DESC
        LIMIT 20
    `;

    const orWhereSql = `(
        audit.username ILIKE '%${term}%'
        OR audit.description ILIKE '%${term}%'
        OR audit.entity_type ILIKE '%${term}%'
        OR audit.action_type ILIKE '%${term}%'
    )`;

    const normal = await AppDataSource.query(explainBase(orWhereSql));
    const normalPlan = normal.map((r: any) => r["QUERY PLAN"]).join("\n");
    logInfo("EXPLAIN (planner default):");
    process.stdout.write(`${normalPlan}\n`);

    const idxRows = await AppDataSource.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'audit_logs'
          AND indexname ILIKE '%trgm%'
        ORDER BY indexname
    `);
    if (!Array.isArray(idxRows) || idxRows.length === 0) {
        throw new Error("No trigram indexes found on audit_logs. Ensure migration 1772200000000 executed on this DB.");
    }
    logInfo(`Found trigram indexes: ${idxRows.map((r: any) => r.indexname).join(", ")}`);

    // TypeORM/pg driver does not reliably return results for multi-statements, so run SET/EXPLAIN separately.
    await AppDataSource.query(`SET enable_seqscan=off`);
    await AppDataSource.query(`SET enable_bitmapscan=on`);
    await AppDataSource.query(`SET enable_indexscan=on`);

    // Verify index usage per-column first (more deterministic than a multi-OR predicate).
    const perColumn: Array<{ name: string; whereSql: string; expectIndex: RegExp }> = [
        { name: "username", whereSql: `audit.username ILIKE '%${term}%'`, expectIndex: /idx_audit_logs_username_trgm/i },
        { name: "description", whereSql: `audit.description ILIKE '%${term}%'`, expectIndex: /idx_audit_logs_description_trgm/i },
        { name: "entity_type", whereSql: `audit.entity_type ILIKE '%${term}%'`, expectIndex: /idx_audit_logs_entity_type_trgm/i },
        { name: "action_type", whereSql: `audit.action_type ILIKE '%${term}%'`, expectIndex: /idx_audit_logs_action_type_trgm/i },
    ];

    for (const item of perColumn) {
        const rows = await AppDataSource.query(explainBase(item.whereSql));
        const plan = (rows ?? []).map((r: any) => r["QUERY PLAN"]).join("\n");
        logInfo(`EXPLAIN (enable_seqscan=off) column=${item.name}:`);
        process.stdout.write(`${plan}\n`);
        assert(item.expectIndex.test(plan), `Expected trigram index usage for ${item.name}, but it did not appear in plan.`);
    }
    logOk("Per-column ILIKE queries can use trigram indexes");

    const forced = await AppDataSource.query(explainBase(orWhereSql));
    await AppDataSource.query(`RESET enable_seqscan`);
    await AppDataSource.query(`RESET enable_bitmapscan`);
    await AppDataSource.query(`RESET enable_indexscan`);
    const forcedPlan = (forced ?? []).map((r: any) => r["QUERY PLAN"]).join("\n");
    logInfo("EXPLAIN (enable_seqscan=off):");
    process.stdout.write(`${forcedPlan}\n`);

    const usesTrgmIndex = /idx_audit_logs_.*_trgm/i.test(forcedPlan);
    assert(
        usesTrgmIndex,
        "Expected trigram index usage in forced plan, but no *_trgm index appeared. If per-column plans used indexes, this OR predicate may still choose Seq Scan due to cost; that is acceptable."
    );
    logOk("Search query can use trigram indexes (verified via forced plan)");
}

async function main() {
    // Safety: refuse to seed data into non-local databases unless explicitly overridden.
    // This script creates branches/users/audit logs for verification.
    const dbHost = String(process.env.DATABASE_HOST || "").trim().toLowerCase();
    const isLocalHost =
        dbHost === "localhost" ||
        dbHost === "127.0.0.1" ||
        dbHost === "::1" ||
        dbHost === "db" || // docker-compose service name
        dbHost.endsWith(".local");
    if (!isLocalHost && !ALLOW_NONLOCAL_SEED) {
        throw new Error(
            `Refusing to seed verification data on non-local DATABASE_HOST=${process.env.DATABASE_HOST}. ` +
            `Set ALLOW_NONLOCAL_SEED=1 to override (not recommended).`
        );
    }

    // Ensure server reachable.
    const health = await fetch(`${BASE_URL}/health`).catch(() => null);
    assert(health && (health as any).ok, `Server not reachable at ${BASE_URL} (GET /health failed)`);
    logOk(`Server reachable: ${BASE_URL}`);

    await ensureDb();

    const seeded = await runWithDbContext(
        { branchId: undefined, userId: "00000000-0000-0000-0000-000000000000", role: "Admin", isAdmin: true },
        async () => {
            const role = await ensureRoleNonAdmin();
            const branchA = await createTestBranch("A");
            const branchB = await createTestBranch("B");

            const runId = randomUUID().replace(/-/g, "").slice(0, 8);
            const ownPass = `Own${runId}!`;
            const branchPass = `Branch${runId}!`;
            const allPass = `All${runId}!`;

            const ownUser = await createTestUser({
                username: `scope_own_${runId}`,
                password: ownPass,
                roleId: role.id,
                branchId: branchA.id,
            });
            const branchUser = await createTestUser({
                username: `scope_branch_${runId}`,
                password: branchPass,
                roleId: role.id,
                branchId: branchA.id,
            });
            const allUser = await createTestUser({
                username: `scope_all_${runId}`,
                password: allPass,
                roleId: role.id,
                branchId: branchA.id,
            });
            const otherBranchUser = await createTestUser({
                username: `scope_other_branch_${runId}`,
                password: `Other${runId}!`,
                roleId: role.id,
                branchId: branchB.id,
            });

            await setAuditPermissionScope(ownUser.id, "own");
            await setAuditPermissionScope(branchUser.id, "branch");
            await setAuditPermissionScope(allUser.id, "all");

            const ids = await seedAuditLogs({
                branchA,
                branchB,
                ownUser,
                sameBranchOtherUser: branchUser,
                otherBranchUser,
            });

            return {
                role,
                branchA,
                branchB,
                ownUser,
                branchUser,
                allUser,
                otherBranchUser,
                ownPass,
                branchPass,
                allPass,
                ids,
            };
        }
    );
    logOk("Seeded test branches/users/audit logs");

    // Verify scopes using each user.
    const ownCookie = await login(seeded.ownUser.username, seeded.ownPass);
    await verifyOwnScope(ownCookie, {
        ownUserId: seeded.ownUser.id,
        otherUserId: seeded.branchUser.id,
        branchBId: seeded.branchB.id,
        ownLogId: seeded.ids.ownLogId,
        otherLogId: seeded.ids.sameBranchOtherLogId,
    });

    const branchCookie = await login(seeded.branchUser.username, seeded.branchPass);
    await verifyBranchScope(branchCookie, {
        branchAId: seeded.branchA.id,
        branchBId: seeded.branchB.id,
        ownUserId: seeded.branchUser.id,
        otherUserSameBranchId: seeded.ownUser.id,
        otherBranchUserId: seeded.otherBranchUser.id,
        branchOtherLogId: seeded.ids.sameBranchOtherLogId,
        otherBranchLogId: seeded.ids.otherBranchLogId,
    });

    const allCookie = await login(seeded.allUser.username, seeded.allPass);
    await verifyRedactionInResponses(allCookie);
    await verifyAllScope(allCookie, {
        branchBId: seeded.branchB.id,
        otherBranchUserId: seeded.otherBranchUser.id,
        otherBranchLogId: seeded.ids.otherBranchLogId,
    });

    await explainAuditSearch();

    logOk("Audit scope verification completed");
    logInfo(`Created users: ${seeded.ownUser.username}, ${seeded.branchUser.username}, ${seeded.allUser.username} (passwords are ephemeral in this run)`);
}

main()
    .then(async () => {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
        process.exit(0);
    })
    .catch(async (err) => {
        console.error("[FAIL]", err);
        try {
            if (AppDataSource.isInitialized) {
                await AppDataSource.destroy();
            }
        } finally {
            process.exit(1);
        }
    });
