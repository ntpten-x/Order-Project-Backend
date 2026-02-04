import { Column, Entity, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from "typeorm"
import { Branch } from "../Branch"

export enum DiscountType {
    Fixed = "Fixed",        // ลดเป็นจำนวนเงินคงที่ (บาท)
    Percentage = "Percentage" // ลดเป็นเปอร์เซ็นต์ (%)
}

@Entity()
@Index(["discount_name", "branch_id"], { unique: true })
@Index(["display_name", "branch_id"], { unique: true })
export class Discounts {
    @PrimaryGeneratedColumn("uuid")
    id!: string // รหัสส่วนลด

    @Column({ type: "varchar", length: 100 })
    discount_name!: string // ชื่อส่วนลด (สำหรับระบบ)

    @Column({ type: "varchar", length: 100 })
    display_name!: string // ชื่อส่วนลดที่แสดงให้ลูกค้าเห็น

    @Index()
    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch

    @Column({ type: "text", nullable: true })
    description?: string // รายละเอียดเงื่อนไข

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    discount_amount!: number // มูลค่าส่วนลด (บาท หรือ %)

    @Column({ type: "enum", enum: DiscountType })
    discount_type!: DiscountType // ประเภทส่วนลด

    @Column({ type: "boolean", default: true })
    is_active!: boolean // สถานะการใช้งาน

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date // วันที่สร้าง
}
