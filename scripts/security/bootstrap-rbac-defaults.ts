import "reflect-metadata";
import { AppDataSource } from "../../src/database/database";
import { ensureRbacDefaults } from "../../src/database/rbac-defaults";

async function main() {
    await AppDataSource.initialize();
    try {
        await ensureRbacDefaults(AppDataSource);
        console.log("[rbac-bootstrap] baseline ensured");
    } finally {
        await AppDataSource.destroy();
    }
}

main().catch((error) => {
    console.error("[rbac-bootstrap] failed:", error);
    process.exit(1);
});
