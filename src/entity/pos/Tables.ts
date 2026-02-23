import { Column, Entity, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from "typeorm";
import { Branch } from "../Branch";

export enum TableStatus {
    Available = "Available",
    Unavailable = "Unavailable"
}

@Entity()
@Index(["table_name", "branch_id"], { unique: true })
export class Tables {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 255 })
    table_name!: string;

    @Index()
    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch;

    @Index()
    @Column({ type: "enum", enum: TableStatus, default: TableStatus.Available })
    status!: TableStatus;

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date;

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    update_date!: Date;

    @Column({ type: "boolean", default: true })
    is_active!: boolean;

    @Column({ type: "varchar", length: 128, nullable: true })
    qr_code_token?: string | null;

    @Column({ type: "timestamptz", nullable: true })
    qr_code_expires_at?: Date | null;
}
