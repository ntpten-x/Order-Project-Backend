import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPermissionsPhase11771300000000 implements MigrationInterface {
    name = "AddPermissionsPhase11771300000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "permission_resources" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "resource_key" character varying(120) NOT NULL,
                "resource_name" character varying(180) NOT NULL,
                "route_pattern" character varying(255),
                "resource_type" character varying(20) NOT NULL,
                "parent_id" uuid,
                "sort_order" integer NOT NULL DEFAULT 0,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_permission_resources_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_permission_resources_key" UNIQUE ("resource_key"),
                CONSTRAINT "CHK_permission_resource_type" CHECK ("resource_type" IN ('page','api','menu','feature'))
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "permission_actions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "action_key" character varying(80) NOT NULL,
                "action_name" character varying(120) NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_permission_actions_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_permission_actions_key" UNIQUE ("action_key")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "role_permissions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "role_id" uuid NOT NULL,
                "resource_id" uuid NOT NULL,
                "action_id" uuid NOT NULL,
                "effect" character varying(10) NOT NULL,
                "scope" character varying(20) NOT NULL DEFAULT 'none',
                "condition_json" jsonb,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_role_permissions_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_role_permissions_role_resource_action" UNIQUE ("role_id", "resource_id", "action_id"),
                CONSTRAINT "FK_role_permissions_role_id" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_role_permissions_resource_id" FOREIGN KEY ("resource_id") REFERENCES "permission_resources"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_role_permissions_action_id" FOREIGN KEY ("action_id") REFERENCES "permission_actions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "CHK_role_permissions_effect" CHECK ("effect" IN ('allow','deny')),
                CONSTRAINT "CHK_role_permissions_scope" CHECK ("scope" IN ('none','own','branch','all'))
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_permission_resources_active_sort"
            ON "permission_resources" ("is_active", "sort_order")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_role_permissions_role"
            ON "role_permissions" ("role_id")
        `);

        await queryRunner.query(`
            INSERT INTO "permission_actions" ("action_key", "action_name")
            VALUES
                ('access', 'Page access'),
                ('view', 'View records'),
                ('create', 'Create records'),
                ('update', 'Update records'),
                ('delete', 'Delete records')
            ON CONFLICT ("action_key") DO NOTHING
        `);

        await queryRunner.query(`
            INSERT INTO "permission_resources" ("resource_key", "resource_name", "route_pattern", "resource_type", "sort_order")
            VALUES
                ('users.page', 'Users Management', '/users', 'page', 10),
                ('roles.page', 'Roles Management', '/roles', 'page', 20),
                ('products.page', 'Products', '/pos/products', 'page', 30),
                ('orders.page', 'Orders', '/pos/orders', 'page', 40),
                ('reports.sales.page', 'Sales Reports', '/pos/dashboard/sales', 'page', 50),
                ('audit.page', 'Audit Logs', '/audit', 'page', 60)
            ON CONFLICT ("resource_key") DO NOTHING
        `);

        await queryRunner.query(`
            WITH seed(role_name, resource_key, action_key, effect, scope) AS (
                VALUES
                    ('Admin', 'users.page', 'access', 'allow', 'all'),
                    ('Admin', 'users.page', 'view', 'allow', 'all'),
                    ('Admin', 'users.page', 'create', 'allow', 'all'),
                    ('Admin', 'users.page', 'update', 'allow', 'all'),
                    ('Admin', 'users.page', 'delete', 'allow', 'all'),
                    ('Admin', 'roles.page', 'access', 'allow', 'all'),
                    ('Admin', 'roles.page', 'view', 'allow', 'all'),
                    ('Admin', 'roles.page', 'create', 'allow', 'all'),
                    ('Admin', 'roles.page', 'update', 'allow', 'all'),
                    ('Admin', 'roles.page', 'delete', 'allow', 'all'),
                    ('Admin', 'products.page', 'access', 'allow', 'all'),
                    ('Admin', 'products.page', 'view', 'allow', 'all'),
                    ('Admin', 'products.page', 'create', 'allow', 'all'),
                    ('Admin', 'products.page', 'update', 'allow', 'all'),
                    ('Admin', 'products.page', 'delete', 'allow', 'all'),
                    ('Admin', 'orders.page', 'access', 'allow', 'all'),
                    ('Admin', 'orders.page', 'view', 'allow', 'all'),
                    ('Admin', 'orders.page', 'create', 'allow', 'all'),
                    ('Admin', 'orders.page', 'update', 'allow', 'all'),
                    ('Admin', 'orders.page', 'delete', 'allow', 'all'),
                    ('Admin', 'reports.sales.page', 'access', 'allow', 'all'),
                    ('Admin', 'reports.sales.page', 'view', 'allow', 'all'),
                    ('Admin', 'audit.page', 'access', 'allow', 'all'),
                    ('Admin', 'audit.page', 'view', 'allow', 'all'),

                    ('Manager', 'users.page', 'access', 'allow', 'branch'),
                    ('Manager', 'users.page', 'view', 'allow', 'branch'),
                    ('Manager', 'users.page', 'create', 'allow', 'branch'),
                    ('Manager', 'users.page', 'update', 'allow', 'branch'),
                    ('Manager', 'users.page', 'delete', 'deny', 'none'),
                    ('Manager', 'roles.page', 'access', 'deny', 'none'),
                    ('Manager', 'roles.page', 'view', 'deny', 'none'),
                    ('Manager', 'products.page', 'access', 'allow', 'branch'),
                    ('Manager', 'products.page', 'view', 'allow', 'branch'),
                    ('Manager', 'products.page', 'create', 'allow', 'branch'),
                    ('Manager', 'products.page', 'update', 'allow', 'branch'),
                    ('Manager', 'products.page', 'delete', 'deny', 'none'),
                    ('Manager', 'orders.page', 'access', 'allow', 'branch'),
                    ('Manager', 'orders.page', 'view', 'allow', 'branch'),
                    ('Manager', 'orders.page', 'create', 'allow', 'branch'),
                    ('Manager', 'orders.page', 'update', 'allow', 'branch'),
                    ('Manager', 'orders.page', 'delete', 'deny', 'none'),
                    ('Manager', 'reports.sales.page', 'access', 'allow', 'branch'),
                    ('Manager', 'reports.sales.page', 'view', 'allow', 'branch'),
                    ('Manager', 'audit.page', 'access', 'deny', 'none'),
                    ('Manager', 'audit.page', 'view', 'deny', 'none'),

                    ('Employee', 'orders.page', 'access', 'allow', 'branch'),
                    ('Employee', 'orders.page', 'view', 'allow', 'branch'),
                    ('Employee', 'orders.page', 'create', 'allow', 'branch'),
                    ('Employee', 'orders.page', 'update', 'allow', 'branch'),
                    ('Employee', 'orders.page', 'delete', 'deny', 'none'),
                    ('Employee', 'products.page', 'access', 'allow', 'branch'),
                    ('Employee', 'products.page', 'view', 'allow', 'branch')
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
            ON CONFLICT ("role_id", "resource_id", "action_id") DO NOTHING
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "permission_actions"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "permission_resources"`);
    }
}
