import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTableQrTokenColumns1772400000000 implements MigrationInterface {
    name = "AddTableQrTokenColumns1772400000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "tables"
            ADD COLUMN IF NOT EXISTS "qr_code_token" varchar(128)
        `);

        await queryRunner.query(`
            ALTER TABLE "tables"
            ADD COLUMN IF NOT EXISTS "qr_code_expires_at" TIMESTAMPTZ
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_tables_qr_code_token"
            ON "tables" ("qr_code_token")
            WHERE "qr_code_token" IS NOT NULL
        `);

        await queryRunner.query(`
            UPDATE "tables"
            SET "qr_code_token" = md5(id::text || clock_timestamp()::text || random()::text)
            WHERE "qr_code_token" IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_tables_qr_code_token"`);
        await queryRunner.query(`ALTER TABLE "tables" DROP COLUMN IF EXISTS "qr_code_expires_at"`);
        await queryRunner.query(`ALTER TABLE "tables" DROP COLUMN IF EXISTS "qr_code_token"`);
    }
}
