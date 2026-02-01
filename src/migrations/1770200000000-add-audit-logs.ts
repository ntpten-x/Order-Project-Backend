import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class AddAuditLogs1770200000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table already exists
        const table = await queryRunner.getTable("audit_logs");
        if (table) {
            console.log("audit_logs table already exists, skipping migration");
            return;
        }

        await queryRunner.createTable(
            new Table({
                name: "audit_logs",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()",
                    },
                    {
                        name: "action_type",
                        type: "varchar",
                        length: "50",
                    },
                    {
                        name: "user_id",
                        type: "uuid",
                        isNullable: true,
                    },
                    {
                        name: "username",
                        type: "varchar",
                        length: "200",
                        isNullable: true,
                    },
                    {
                        name: "ip_address",
                        type: "varchar",
                        length: "50",
                    },
                    {
                        name: "user_agent",
                        type: "text",
                        isNullable: true,
                    },
                    {
                        name: "entity_type",
                        type: "varchar",
                        length: "100",
                        isNullable: true,
                    },
                    {
                        name: "entity_id",
                        type: "uuid",
                        isNullable: true,
                    },
                    {
                        name: "branch_id",
                        type: "uuid",
                        isNullable: true,
                    },
                    {
                        name: "old_values",
                        type: "jsonb",
                        isNullable: true,
                    },
                    {
                        name: "new_values",
                        type: "jsonb",
                        isNullable: true,
                    },
                    {
                        name: "description",
                        type: "text",
                        isNullable: true,
                    },
                    {
                        name: "path",
                        type: "varchar",
                        length: "500",
                        isNullable: true,
                    },
                    {
                        name: "method",
                        type: "varchar",
                        length: "10",
                        isNullable: true,
                    },
                    {
                        name: "created_at",
                        type: "timestamptz",
                        default: "CURRENT_TIMESTAMP",
                    },
                ],
            }),
            true
        );

        // Create indexes
        await queryRunner.createIndex(
            "audit_logs",
            new TableIndex({
                name: "IDX_audit_logs_user_id_created_at",
                columnNames: ["user_id", "created_at"],
            })
        );

        await queryRunner.createIndex(
            "audit_logs",
            new TableIndex({
                name: "IDX_audit_logs_action_type_created_at",
                columnNames: ["action_type", "created_at"],
            })
        );

        await queryRunner.createIndex(
            "audit_logs",
            new TableIndex({
                name: "IDX_audit_logs_entity_type_entity_id",
                columnNames: ["entity_type", "entity_id"],
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("audit_logs");
    }
}
