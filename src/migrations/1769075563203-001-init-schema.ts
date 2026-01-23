import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1769075563203 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Baseline migration (no operations) created to record the current schema.
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No reversal as this migration only marks the existing schema baseline.
    }

}
