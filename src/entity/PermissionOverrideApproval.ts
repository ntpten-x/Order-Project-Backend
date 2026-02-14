import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Users } from "./Users";

@Entity("permission_override_approvals")
export class PermissionOverrideApproval {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ name: "target_user_id", type: "uuid" })
    target_user_id!: string;

    @ManyToOne(() => Users)
    @JoinColumn({ name: "target_user_id" })
    target_user?: Users;

    @Column({ name: "requested_by_user_id", type: "uuid" })
    requested_by_user_id!: string;

    @ManyToOne(() => Users)
    @JoinColumn({ name: "requested_by_user_id" })
    requested_by_user?: Users;

    @Column({ name: "reviewed_by_user_id", type: "uuid", nullable: true })
    reviewed_by_user_id?: string | null;

    @ManyToOne(() => Users)
    @JoinColumn({ name: "reviewed_by_user_id" })
    reviewed_by_user?: Users | null;

    @Column({ type: "varchar", length: 20, default: "pending" })
    status!: "pending" | "approved" | "rejected";

    @Column({ type: "text", nullable: true })
    reason?: string | null;

    @Column({ name: "review_reason", type: "text", nullable: true })
    review_reason?: string | null;

    @Column({ name: "risk_flags", type: "jsonb", default: () => "'[]'::jsonb" })
    risk_flags!: string[];

    @Column({ name: "permissions_payload", type: "jsonb" })
    permissions_payload!: unknown;

    @CreateDateColumn({ name: "created_at", type: "timestamptz" })
    created_at!: Date;

    @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
    reviewed_at?: Date | null;
}

