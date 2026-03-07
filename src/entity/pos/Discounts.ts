import { Column, Entity, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from "typeorm"
import { Branch } from "../Branch"

export enum DiscountType {
    Fixed = "Fixed",
    Percentage = "Percentage"
}

@Entity()
@Index(["display_name", "branch_id"], { unique: true })
export class Discounts {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 100 })
    display_name!: string

    @Index()
    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch

    @Column({ type: "text", nullable: true })
    description?: string

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    discount_amount!: number

    @Column({ type: "enum", enum: DiscountType })
    discount_type!: DiscountType

    @Column({ type: "boolean", default: true })
    is_active!: boolean

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date
}
