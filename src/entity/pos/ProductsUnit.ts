import { Column, Entity, PrimaryGeneratedColumn, OneToMany, Index, ManyToOne, JoinColumn } from "typeorm"
import { Products } from "./Products"
import { Branch } from "../Branch"

@Entity()
@Index(["unit_name", "branch_id"], { unique: true })
@Index(["display_name", "branch_id"], { unique: true })
export class ProductsUnit {
    @PrimaryGeneratedColumn("uuid")
    id!: string // รหัสหน่วยสินค้า

    @Column({ type: "varchar", length: 100 })
    unit_name!: string // ชื่อหน่วย (ระบบ)

    @Column({ type: "varchar", length: 100 })
    display_name!: string // ชื่อหน่วย (แสดงผล)

    @Index()
    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date // วันที่สร้าง

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    update_date!: Date // วันที่แก้ไข

    @Index()
    @Column({ type: "boolean", default: true })
    is_active!: boolean // สถานะการใช้งาน

    @OneToMany(() => Products, (products) => products.unit)
    products!: Products[] // รายการสินค้าที่ใช้หน่วยนี้
}
