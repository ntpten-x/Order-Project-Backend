import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductsUnitPagePermissions1773100000000 implements MigrationInterface {
    name = "AddProductsUnitPagePermissions1773100000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure the permission resource exists for the Products Unit page.
        await queryRunner.query(`
            INSERT INTO "permission_resources" ("resource_key", "resource_name", "route_pattern", "resource_type", "sort_order")
            VALUES ('products_unit.page', 'Product Units', '/pos/productsUnit', 'page', 23)
            ON CONFLICT ("resource_key") DO NOTHING
        `);

        // Seed baseline role permissions for the new resource (match existing phase1 policies).
        await queryRunner.query(`
            WITH seed(role_name, resource_key, action_key, effect, scope) AS (
                VALUES
                    ('Admin', 'products_unit.page', 'access', 'allow', 'all'),
                    ('Admin', 'products_unit.page', 'view', 'allow', 'all'),
                    ('Admin', 'products_unit.page', 'create', 'allow', 'all'),
                    ('Admin', 'products_unit.page', 'update', 'allow', 'all'),
                    ('Admin', 'products_unit.page', 'delete', 'allow', 'all'),

                    ('Manager', 'products_unit.page', 'access', 'allow', 'branch'),
                    ('Manager', 'products_unit.page', 'view', 'allow', 'branch'),
                    ('Manager', 'products_unit.page', 'create', 'allow', 'branch'),
                    ('Manager', 'products_unit.page', 'update', 'allow', 'branch'),
                    ('Manager', 'products_unit.page', 'delete', 'deny', 'none'),

                    ('Employee', 'products_unit.page', 'access', 'allow', 'branch'),
                    ('Employee', 'products_unit.page', 'view', 'allow', 'branch'),
                    ('Employee', 'products_unit.page', 'create', 'deny', 'none'),
                    ('Employee', 'products_unit.page', 'update', 'deny', 'none'),
                    ('Employee', 'products_unit.page', 'delete', 'deny', 'none')
            )
            INSERT INTO "role_permissions" ("role_id", "resource_id", "action_id", "effect", "scope")
            SELECT
                r.id,
                pr.id,
                pa.id,
                seed.effect::varchar,
                seed.scope::varchar
            FROM seed
            INNER JOIN "roles" r ON lower(r.roles_name) = lower(seed.role_name)
            INNER JOIN "permission_resources" pr ON pr.resource_key = seed.resource_key
            INNER JOIN "permission_actions" pa ON pa.action_key = seed.action_key
            WHERE NOT EXISTS (
                SELECT 1
                FROM "role_permissions" rp
                WHERE rp."role_id" = r.id
                  AND rp."resource_id" = pr.id
                  AND rp."action_id" = pa.id
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "role_permissions"
            WHERE "resource_id" IN (SELECT id FROM "permission_resources" WHERE resource_key = 'products_unit.page')
        `);
        await queryRunner.query(`DELETE FROM "permission_resources" WHERE resource_key = 'products_unit.page'`);
    }
}
