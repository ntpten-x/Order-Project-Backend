import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("branches")
export class Branch {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 100 })
    branch_name!: string;

    @Column({ type: "varchar", length: 20, unique: true })
    branch_code!: string;

    @Column({ type: "text", nullable: true })
    address?: string;

    @Column({ type: "varchar", length: 20, nullable: true })
    phone?: string;

    @Column({ type: "varchar", length: 50, nullable: true })
    tax_id?: string;

    @Column({ type: "boolean", default: true })
    is_active!: boolean;

    @CreateDateColumn()
    create_date!: Date;

    @UpdateDateColumn()
    update_date!: Date;
}
