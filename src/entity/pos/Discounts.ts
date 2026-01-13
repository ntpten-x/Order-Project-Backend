import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

export enum DiscountType {
    Fixed = "Fixed",        // ลดเป็นจำนวนเงินคงที่ (บาท)
    Percentage = "Percentage" // ลดเป็นเปอร์เซ็นต์ (%)
}

@Entity()
export class Discounts {
    @PrimaryGeneratedColumn("uuid")
    id!: string // รหัสส่วนลด

    @Column({ type: "varchar", length: 100, unique: true })
    discount_name!: string // ชื่อส่วนลด (สำหรับระบบ)

    @Column({ type: "varchar", length: 100, unique: true })
    display_name!: string // ชื่อส่วนลดที่แสดงให้ลูกค้าเห็น

    @Column({ type: "text" })
    description!: string // รายละเอียดเงื่อนไข

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    discount_amount!: number // มูลค่าส่วนลด (บาท หรือ %)

    @Column({ type: "enum", enum: DiscountType })
    discount_type!: DiscountType // ประเภทส่วนลด

    @Column({ type: "boolean", default: true })
    is_active!: boolean // สถานะการใช้งาน

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date // วันที่สร้าง
}