import { MigrationInterface, QueryRunner } from "typeorm";

export class RemovePosMasterLegacyNameColumns1772900000000 implements MigrationInterface {
    name = "RemovePosMasterLegacyNameColumns1772900000000";

    private readonly legacyColumns = [
        { table: "category", column: `category_${"name"}` },
        { table: "discounts", column: `discount_${"name"}` },
        { table: "products", column: `product_${"name"}` },
        { table: "products_unit", column: `unit_${"name"}` },
    ] as const;

    private quote(value: string): string {
        return `"${value}"`;
    }

    private async dropLegacyColumns(queryRunner: QueryRunner): Promise<void> {
        for (const entry of this.legacyColumns) {
            await queryRunner.query(
                `ALTER TABLE ${this.quote(entry.table)} DROP COLUMN IF EXISTS ${this.quote(entry.column)}`
            );
        }
    }

    private async restoreLegacyColumns(queryRunner: QueryRunner): Promise<void> {
        for (const entry of this.legacyColumns) {
            await queryRunner.query(
                `ALTER TABLE ${this.quote(entry.table)} ADD COLUMN IF NOT EXISTS ${this.quote(entry.column)} character varying(100)`
            );
            await queryRunner.query(
                `UPDATE ${this.quote(entry.table)} SET ${this.quote(entry.column)} = COALESCE("display_name", '') WHERE ${this.quote(entry.column)} IS NULL`
            );
            await queryRunner.query(
                `ALTER TABLE ${this.quote(entry.table)} ALTER COLUMN ${this.quote(entry.column)} SET NOT NULL`
            );
        }
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.dropLegacyColumns(queryRunner);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_display_name" ON "products" ("display_name")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_display_name"`);
        await this.restoreLegacyColumns(queryRunner);
    }
}
