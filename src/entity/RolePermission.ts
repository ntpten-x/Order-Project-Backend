import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("role_permissions")
export class RolePermission {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ name: "role_id", type: "uuid" })
    role_id!: string;

    @Column({ name: "resource_id", type: "uuid" })
    resource_id!: string;

    @Column({ name: "action_id", type: "uuid" })
    action_id!: string;

    @Column({ name: "effect", type: "varchar", length: 10 })
    effect!: "allow" | "deny";

    @Column({ name: "scope", type: "varchar", length: 20, default: "none" })
    scope!: "none" | "own" | "branch" | "all";

    @Column({ name: "condition_json", type: "jsonb", nullable: true })
    condition_json?: Record<string, unknown>;

    @Column({ name: "created_at", type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    created_at!: Date;

    @Column({ name: "updated_at", type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    updated_at!: Date;
}
