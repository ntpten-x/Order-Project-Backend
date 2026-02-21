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

async function setSessionContext(
    queryRunner: QueryRunner,
    params: { branchId: string; userId: string; role: string; isAdmin: string }
): Promise<void> {
    await queryRunner.query(
        `
            SELECT
                set_config('app.branch_id', $1, false),
                set_config('app.user_id', $2, false),
                set_config('app.user_role', $3, false),
                set_config('app.is_admin', $4, false)
        `,
        [params.branchId, params.userId, params.role, params.isAdmin]
    );
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

    await setSessionContext(queryRunner, {
        branchId: branchValue,
        userId: userIdValue,
        role: roleValue,
        isAdmin: isAdminValue,
    });

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
            await setSessionContext(queryRunner, {
                branchId: "",
                userId: "",
                role: "",
                isAdmin: "false",
            });
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
