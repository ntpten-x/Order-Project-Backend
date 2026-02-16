import { AppDataSource } from "../../src/database/database";
import { Branch } from "../../src/entity/Branch";
import { Users } from "../../src/entity/Users";
import { Roles } from "../../src/entity/Roles";
import { PermissionResource } from "../../src/entity/PermissionResource";
import { PermissionAction } from "../../src/entity/PermissionAction";
import { UserPermission } from "../../src/entity/UserPermission";
import bcrypt from "bcrypt";
import { runWithDbContext } from "../../src/database/dbContext";
import type { DeepPartial } from "typeorm";

type Scope = "none" | "own" | "branch" | "all";
type Effect = "allow" | "deny";

const ADMIN_USERNAME = process.env.E2E_USERS_ADMIN_USERNAME || "e2e_users_admin";
const ADMIN_PASSWORD = process.env.E2E_USERS_ADMIN_PASSWORD || "E2E_Users_Admin_123!";
const MANAGER_USERNAME = process.env.E2E_USERS_MANAGER_USERNAME || "e2e_users_manager";
const MANAGER_PASSWORD = process.env.E2E_USERS_MANAGER_PASSWORD || "E2E_Users_Manager_123!";

const ALLOW_NONLOCAL_SEED = process.env.ALLOW_NONLOCAL_SEED === "1";

function assert(condition: any, message: string) {
    if (!condition) throw new Error(message);
}

function logInfo(msg: string) {
    process.stdout.write(`[INFO] ${msg}\n`);
}

async function ensureDb() {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
}

async function ensureRole(roleName: "Admin" | "Manager" | "Employee"): Promise<Roles> {
    const repo = AppDataSource.getRepository(Roles);
    const direct = await repo.findOne({ where: { roles_name: roleName } as any });
    if (direct) return direct;
    const all = await repo.find();
    const found = all.find((r) => String(r.roles_name || "").toLowerCase() === roleName.toLowerCase());
    assert(found, `Role not found: ${roleName}`);
    return found!;
}

async function ensurePermissionResource(resource_key: string): Promise<PermissionResource> {
    const repo = AppDataSource.getRepository(PermissionResource);
    const existing = await repo.findOneBy({ resource_key } as any);
    if (existing) return existing;
    const created = repo.create({
        resource_key,
        resource_name: resource_key,
        resource_type: "page",
        sort_order: 0,
        is_active: true,
    });
    return (await repo.save(created as any)) as PermissionResource;
}

async function ensurePermissionAction(action_key: string): Promise<PermissionAction> {
    const repo = AppDataSource.getRepository(PermissionAction);
    const existing = await repo.findOneBy({ action_key } as any);
    if (existing) return existing;
    const created = repo.create({
        action_key,
        action_name: action_key,
        is_active: true,
    });
    return (await repo.save(created as any)) as PermissionAction;
}

async function setUserPermission(params: {
    userId: string;
    resourceId: string;
    actionId: string;
    effect: Effect;
    scope: Scope;
}) {
    const repo = AppDataSource.getRepository(UserPermission);
    await repo.delete({ user_id: params.userId, resource_id: params.resourceId, action_id: params.actionId } as any);
    await repo.save(
        repo.create({
            user_id: params.userId,
            resource_id: params.resourceId,
            action_id: params.actionId,
            effect: params.effect,
            scope: params.scope,
        } as any)
    );
}

async function upsertBranch(branchCode: string): Promise<Branch> {
    const repo = AppDataSource.getRepository(Branch);
    const existing = await repo.findOne({ where: { branch_code: branchCode } as any });
    if (existing) return existing;
    const created = repo.create({
        branch_name: "E2E Users Branch",
        branch_code: branchCode,
        address: "E2E address",
        phone: "0800000000",
        tax_id: "E2E-TAX",
        is_active: true,
    } as DeepPartial<Branch>);
    return await repo.save(created);
}

async function upsertUser(params: { username: string; password: string; name: string; roleId: string; branchId: string }): Promise<Users> {
    const repo = AppDataSource.getRepository(Users);
    const existing = await repo.findOne({ where: { username: params.username } as any });
    const passwordHash = await bcrypt.hash(params.password, 10);
    if (existing) {
        await repo.update(existing.id, {
            name: params.name,
            password: passwordHash,
            roles_id: params.roleId,
            branch_id: params.branchId,
            is_use: true,
        } as any);
        const updated = await repo.findOne({ where: { id: existing.id } as any });
        assert(updated, "Failed to reload updated user");
        return updated!;
    }

    const created: Users = repo.create({
        username: params.username,
        name: params.name,
        password: passwordHash,
        roles_id: params.roleId,
        branch_id: params.branchId,
        is_use: true,
        is_active: false,
    } as DeepPartial<Users>);
    return await repo.save(created);
}

async function upsertEmployee(seedBranchId: string, employeeRoleId: string): Promise<Users> {
    const repo = AppDataSource.getRepository(Users);
    const username = "e2e_users_employee";
    const existing = await repo.findOne({ where: { username } as any });
    const passwordHash = await bcrypt.hash("E2E_Users_Employee_123!", 10);
    if (existing) {
        await repo.update(existing.id, { roles_id: employeeRoleId, branch_id: seedBranchId, password: passwordHash, is_use: true } as any);
        return (await repo.findOne({ where: { id: existing.id } as any }))!;
    }
    const created: Users = repo.create({
        username,
        name: "E2E Employee",
        password: passwordHash,
        roles_id: employeeRoleId,
        branch_id: seedBranchId,
        is_use: true,
        is_active: false,
    } as DeepPartial<Users>);
    return await repo.save(created);
}

async function main() {
    const dbHost = String(process.env.DATABASE_HOST || "").trim().toLowerCase();
    const isLocalHost =
        dbHost === "localhost" ||
        dbHost === "127.0.0.1" ||
        dbHost === "::1" ||
        dbHost === "db" ||
        dbHost.endsWith(".local");
    if (!isLocalHost && !ALLOW_NONLOCAL_SEED) {
        throw new Error(
            `Refusing to seed on non-local DATABASE_HOST=${process.env.DATABASE_HOST}. Set ALLOW_NONLOCAL_SEED=1 to override.`
        );
    }

    await ensureDb();

    await runWithDbContext(
        { branchId: undefined, userId: "00000000-0000-0000-0000-000000000000", role: "Admin", isAdmin: true },
        async () => {
            const adminRole = await ensureRole("Admin");
            const managerRole = await ensureRole("Manager");
            const employeeRole = await ensureRole("Employee");

            const branch = await upsertBranch("E2E_USERS");

            const admin = await upsertUser({
                username: ADMIN_USERNAME,
                password: ADMIN_PASSWORD,
                name: "E2E Users Admin",
                roleId: adminRole.id,
                branchId: branch.id,
            });

            const manager = await upsertUser({
                username: MANAGER_USERNAME,
                password: MANAGER_PASSWORD,
                name: "E2E Users Manager",
                roleId: managerRole.id,
                branchId: branch.id,
            });

            const employee = await upsertEmployee(branch.id, employeeRole.id);

            // Make manager permissions deterministic for UI testing.
            const resource = await ensurePermissionResource("users.page");
            const view = await ensurePermissionAction("view");
            const create = await ensurePermissionAction("create");
            const update = await ensurePermissionAction("update");
            const del = await ensurePermissionAction("delete");
            await setUserPermission({ userId: manager.id, resourceId: resource.id, actionId: view.id, effect: "allow", scope: "branch" });
            await setUserPermission({ userId: manager.id, resourceId: resource.id, actionId: create.id, effect: "allow", scope: "branch" });
            await setUserPermission({ userId: manager.id, resourceId: resource.id, actionId: update.id, effect: "allow", scope: "branch" });
            await setUserPermission({ userId: manager.id, resourceId: resource.id, actionId: del.id, effect: "deny", scope: "none" });

            logInfo("Seeded Users UI E2E accounts (local DB only):");
            logInfo(`- Admin: ${admin.username} / ${ADMIN_PASSWORD}`);
            logInfo(`- Manager: ${manager.username} / ${MANAGER_PASSWORD} (branch scoped)`);
            logInfo(`- Employee: ${employee.username} / E2E_Users_Employee_123!`);
            logInfo(`- Branch: ${branch.branch_name} (${branch.branch_code})`);
        }
    );
}

main()
    .then(async () => {
        if (AppDataSource.isInitialized) await AppDataSource.destroy();
        process.exit(0);
    })
    .catch(async (err) => {
        console.error("[FAIL]", err);
        try {
            if (AppDataSource.isInitialized) await AppDataSource.destroy();
        } finally {
            process.exit(1);
        }
    });
