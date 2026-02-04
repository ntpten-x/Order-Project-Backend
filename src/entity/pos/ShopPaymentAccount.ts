import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import { ShopProfile } from "./ShopProfile"
import { Branch } from "../Branch"

export enum AccountType {
    PROMPTPAY = "PromptPay",
    BANK_ACCOUNT = "BankAccount"
}

@Entity()
@Index(["branch_id"])
export class ShopPaymentAccount {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch

    @Column({ type: "uuid" })
    shop_id!: string

    @ManyToOne(() => ShopProfile, { onDelete: "CASCADE" })
    @JoinColumn({ name: "shop_id" })
    shop!: ShopProfile

    @Column({ type: "varchar", length: 100 })
    account_name!: string // ชื่อบัญชี / ธนาคาร

    @Column({ type: "varchar", length: 50 })
    account_number!: string // เบอร์พร้อมเพย์ / เลขบัญชี

    @Column({ type: "varchar", length: 100, nullable: true })
    bank_name?: string // ชื่อธนาคาร (สำหรับบัญชีธนาคาร)

    @Column({ type: "text", nullable: true })
    address?: string // ที่อยู่สำหรับบัญชีนี้

    @Column({ type: "varchar", length: 20, nullable: true })
    phone?: string // เบอร์โทรสำรอง/สาขา

    @Column({ type: "varchar", length: 20, default: AccountType.PROMPTPAY })
    account_type!: string

    @Column({ type: "boolean", default: false })
    is_active!: boolean

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date
}
