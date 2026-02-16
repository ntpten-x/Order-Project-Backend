import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPosPaymentAccountsPerformanceIndexes1773500000000 implements MigrationInterface {
    name = "AddPosPaymentAccountsPerformanceIndexes1773500000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Optimize list operations by shop + branch, ordered by active first then newest.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_shop_payment_account_shop_branch_active_created_desc
            ON "shop_payment_account" ("shop_id", "branch_id", "is_active", "created_at" DESC)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_shop_payment_account_shop_branch_active_created_desc`);
    }
}

