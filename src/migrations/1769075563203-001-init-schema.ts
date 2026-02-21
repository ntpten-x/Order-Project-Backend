import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1769075563203 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Historical projects shipped this migration as a baseline marker only.
        // For fresh environments that have no baseline schema, bootstrap once so
        // following migrations can run in migration-only mode (TYPEORM_SYNC=false).
        const hasRolesTable = await queryRunner.hasTable("roles");
        if (hasRolesTable) {
            return;
        }

        await queryRunner.connection.synchronize(false);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No reversal as this migration only marks the existing schema baseline.
    }

}
