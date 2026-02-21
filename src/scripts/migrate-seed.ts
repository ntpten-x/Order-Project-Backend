import "reflect-metadata";
import { AppDataSource } from "../database/database";
import { ensureRbacDefaults } from "../database/rbac-defaults";

async function main(): Promise<void> {
    const shouldRunMigrations = process.env.RUN_MIGRATIONS_ON_START !== "false";
    const shouldEnsureRbac = process.env.RUN_RBAC_BASELINE_ON_START !== "false";

    await AppDataSource.initialize();
    try {
        if (shouldRunMigrations) {
            const hasPending = await AppDataSource.showMigrations();
            if (hasPending) {
                const applied = await AppDataSource.runMigrations();
                console.log(`[migrate-seed] Migrations applied: ${applied.length}`);
            } else {
                console.log("[migrate-seed] No pending migrations.");
            }
        } else {
            console.log("[migrate-seed] Migration step skipped (RUN_MIGRATIONS_ON_START=false).");
        }

        if (shouldEnsureRbac) {
            await ensureRbacDefaults(AppDataSource);
            console.log("[migrate-seed] RBAC baseline ensured.");
        } else {
            console.log("[migrate-seed] RBAC bootstrap skipped (RUN_RBAC_BASELINE_ON_START=false).");
        }
    } finally {
        await AppDataSource.destroy();
    }
}

main().catch((error) => {
    console.error("[migrate-seed] Failed:", error);
    process.exit(1);
});
