import { Column, Entity, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn, UpdateDateColumn } from "typeorm"
import { Branch } from "../Branch"

@Entity()
@Index(["branch_id"])
export class ShopProfile {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ name: "branch_id", type: "uuid" })
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

    @Column({ type: "varchar", length: 128, nullable: true })
    takeaway_qr_token?: string | null

    @Column({ type: "timestamptz", nullable: true })
    takeaway_qr_expires_at?: Date | null

    // Payment Config
    @Column({ type: "varchar", length: 50, nullable: true })
    promptpay_number!: string // เบอร์พร้อมเพย์ หรือ เลขบัตรประชาชน

    @Column({ type: "varchar", length: 200, nullable: true })
    promptpay_name!: string // ชื่อบัญชีพร้อมเพย์

    @Column({ type: "varchar", length: 100, nullable: true })
    bank_name?: string

    @Column({ type: "varchar", length: 20, default: "PromptPay" })
    account_type!: string

    @UpdateDateColumn({ type: "timestamptz" })
    update_date!: Date
}
