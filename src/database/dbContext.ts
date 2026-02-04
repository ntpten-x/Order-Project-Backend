import { AsyncLocalStorage } from "node:async_hooks";
import { EntityManager, EntityTarget, ObjectLiteral, QueryRunner, Repository } from "typeorm";
import { AppDataSource } from "./database";

export type DbContext = {
    manager: EntityManager;
    queryRunner: QueryRunner;
    branchId?: string;
    userId?: string;
    role?: string;
    isAdmin?: boolean;
};

const storage = new AsyncLocalStorage<DbContext>();

export function getDbContext(): DbContext | undefined {
    return storage.getStore();
}

export function getDbManager(): EntityManager {
    return storage.getStore()?.manager ?? AppDataSource.manager;
}

export function getRepository<Entity extends ObjectLiteral>(entity: EntityTarget<Entity>): Repository<Entity> {
    return getDbManager().getRepository(entity);
}

async function setSessionGuc(queryRunner: QueryRunner, key: string, value: string): Promise<void> {
    await queryRunner.query(`SELECT set_config($1, $2, false)`, [key, value]);
}

export async function runWithDbContext<T>(
    params: { branchId?: string; userId?: string; role?: string; isAdmin?: boolean },
    fn: () => Promise<T>
): Promise<T> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    const branchValue = params.branchId ?? "";
    const userIdValue = params.userId ?? "";
    const roleValue = params.role ?? "";
    const isAdminValue = params.isAdmin ? "true" : "false";

    await setSessionGuc(queryRunner, "app.branch_id", branchValue);
    await setSessionGuc(queryRunner, "app.user_id", userIdValue);
    await setSessionGuc(queryRunner, "app.user_role", roleValue);
    await setSessionGuc(queryRunner, "app.is_admin", isAdminValue);

    try {
        return await storage.run(
            {
                manager: queryRunner.manager,
                queryRunner,
                branchId: params.branchId,
                userId: params.userId,
                role: params.role,
                isAdmin: params.isAdmin,
            },
            fn
        );
    } finally {
        try {
            await setSessionGuc(queryRunner, "app.branch_id", "");
            await setSessionGuc(queryRunner, "app.user_id", "");
            await setSessionGuc(queryRunner, "app.user_role", "");
            await setSessionGuc(queryRunner, "app.is_admin", "false");
        } catch (error) {
            console.warn("[DB] Failed to reset session context:", error);
        }

        try {
            await queryRunner.release();
        } catch (error) {
            console.warn("[DB] Failed to release query runner:", error);
        }
    }
}

export async function runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    const store = storage.getStore();

    if (store) {
        return store.manager.transaction(async (txManager) => {
            return storage.run({ ...store, manager: txManager }, () => fn(txManager));
        });
    }

    return AppDataSource.transaction(async (txManager) => fn(txManager));
}
