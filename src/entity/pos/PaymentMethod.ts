import { Column, Entity, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from "typeorm"
import { Branch } from "../Branch"

@Entity()
@Index(["payment_method_name", "branch_id"], { unique: true })
@Index(["display_name", "branch_id"], { unique: true })
export class PaymentMethod {
    @PrimaryGeneratedColumn("uuid")
    id!: string // รหัสวิธีการชำระเงิน

    @Column({ type: "varchar", length: 100 })
    payment_method_name!: string // ชื่อวิธีการชำระเงิน (เช่น Cash, Credit Card)

    @Column({ type: "varchar", length: 100 })
    display_name!: string // ชื่อที่แสดงให้เห็น (เช่น เงินสด, บัตรเครดิต)

    @Index()
    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch

    @Column({ type: "boolean", default: true })
    is_active!: boolean // สถานะการใช้งาน

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date // วันที่สร้าง
}
