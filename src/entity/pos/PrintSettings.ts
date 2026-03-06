import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { Branch } from "../Branch";
import {
    PrintAutomationSettings,
    PrintSettingsDocuments,
    PrintUnit,
} from "../../utils/printSettings";

@Entity("print_settings")
@Index(["branch_id"], { unique: true })
export class PrintSettings {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ name: "branch_id", type: "uuid" })
    branch_id!: string;

    @ManyToOne(() => Branch, { onDelete: "CASCADE" })
    @JoinColumn({ name: "branch_id" })
    branch?: Branch;

    @Column({ name: "default_unit", type: "varchar", length: 10, default: "mm" })
    default_unit!: PrintUnit;

    @Column({ type: "varchar", length: 20, default: "th-TH" })
    locale!: string;

    @Column({ type: "boolean", default: true })
    allow_manual_override!: boolean;

    @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
    documents!: PrintSettingsDocuments;

    @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
    automation!: PrintAutomationSettings;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}

