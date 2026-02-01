import { Column, Entity, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from "typeorm"
import { Branch } from "../Branch"

@Entity()
@Index(["branch_id"])
export class ShopProfile {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ name: "branch_id", type: "uuid", nullable: true })
    branch_id?: string

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch

    @Column({ type: "varchar", length: 200, default: "My Shop" })
    shop_name!: string

    @Column({ type: "text", nullable: true })
    address!: string

    @Column({ type: "varchar", length: 20, nullable: true })
    phone!: string

    // Payment Config
    @Column({ type: "varchar", length: 50, nullable: true })
    promptpay_number!: string // เบอร์พร้อมเพย์ หรือ เลขบัตรประชาชน

    @Column({ type: "varchar", length: 200, nullable: true })
    promptpay_name!: string // ชื่อบัญชีพร้อมเพย์

    @Column({ type: "varchar", length: 100, nullable: true })
    bank_name?: string

    @Column({ type: "varchar", length: 20, default: "PromptPay" })
    account_type!: string

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    update_date!: Date
}
