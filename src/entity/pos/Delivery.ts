import { Column, Entity, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Branch } from "../Branch";

@Entity()
@Index(["branch_id"])
export class Delivery {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch;

    @Column({ type: "varchar", length: 255 })
    delivery_name!: string;

    @Column({ type: "varchar", length: 50, nullable: true })
    delivery_prefix?: string | null;

    @Column({ type: "text", nullable: true })
    logo?: string | null;

    @CreateDateColumn({ type: "timestamptz" })
    create_date!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    update_date!: Date;

    @Column({ type: "boolean", default: true })
    is_active!: boolean;
}
