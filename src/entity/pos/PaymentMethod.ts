import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity()
export class PaymentMethod {
    @PrimaryGeneratedColumn("uuid")
    id!: string // รหัสวิธีการชำระเงิน

    @Column({ type: "varchar", length: 100, unique: true })
    payment_method_name!: string // ชื่อวิธีการชำระเงิน (เช่น Cash, Credit Card)

    @Column({ type: "varchar", length: 100, unique: true })
    display_name!: string // ชื่อที่แสดงให้เห็น (เช่น เงินสด, บัตรเครดิต)

    @Column({ type: "boolean", default: true })
    is_active!: boolean // สถานะการใช้งาน

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date // วันที่สร้าง
}