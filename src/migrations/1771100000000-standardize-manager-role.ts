import { MigrationInterface, QueryRunner } from "typeorm";

type RoleRow = {
    id: string;
    roles_name: string;
};

export class StandardizeManagerRole1771100000000 implements MigrationInterface {
    name = "StandardizeManagerRole1771100000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const roleRows = (await queryRunner.query(
            `
            SELECT id, roles_name
            FROM roles
            WHERE lower(roles_name) IN ('manager', 'maneger')
            ORDER BY CASE WHEN roles_name = 'Manager' THEN 0 ELSE 1 END, create_date ASC
            `
        )) as RoleRow[];

        if (!roleRows.length) return;

        let canonical = roleRows.find((row) => row.roles_name === "Manager") ?? roleRows[0];

        if (canonical.roles_name !== "Manager") {
            await queryRunner.query(
                `
                UPDATE roles
                SET roles_name = 'Manager'
                WHERE id = $1
                `,
                [canonical.id]
            );
            canonical = { ...canonical, roles_name: "Manager" };
        }

        const duplicateIds = roleRows
            .filter((row) => row.id !== canonical.id)
            .map((row) => row.id);

        if (!duplicateIds.length) return;

        await queryRunner.query(
            `
            UPDATE users
            SET roles_id = $1
            WHERE roles_id = ANY($2::uuid[])
            `,
            [canonical.id, duplicateIds]
        );

        await queryRunner.query(
            `
            DELETE FROM roles
            WHERE id = ANY($1::uuid[])
            `,
            [duplicateIds]
        );
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Irreversible data standardization.
    }
}
