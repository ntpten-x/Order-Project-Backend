import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("permission_audits")
export class PermissionAudit {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ name: "actor_user_id", type: "uuid" })
    actor_user_id!: string;

    @Column({ name: "target_type", type: "varchar", length: 10 })
    target_type!: "role" | "user";

    @Column({ name: "target_id", type: "uuid" })
    target_id!: string;

    @Column({ name: "action_type", type: "varchar", length: 30 })
    action_type!: string;

    @Column({ name: "payload_before", type: "jsonb", nullable: true })
    payload_before?: Record<string, unknown>;

    @Column({ name: "payload_after", type: "jsonb", nullable: true })
    payload_after?: Record<string, unknown>;

    @Column({ name: "reason", type: "text", nullable: true })
    reason?: string;

    @Column({ name: "created_at", type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    created_at!: Date;
}
