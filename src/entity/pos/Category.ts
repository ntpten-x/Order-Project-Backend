import { Column, Entity, PrimaryGeneratedColumn, OneToMany, Index, ManyToOne, JoinColumn } from "typeorm"
import { Products } from "./Products"
import { Branch } from "../Branch"

@Entity()
@Index(["category_name", "branch_id"], { unique: true })
@Index(["display_name", "branch_id"], { unique: true })
export class Category {
    @PrimaryGeneratedColumn("uuid")
    id!: string // รหัสหมวดหมู่

    @Column({ type: "varchar", length: 100 })
    category_name!: string // ชื่อหมวดหมู่ (ระบบ)

    @Column({ type: "varchar", length: 100 })
    display_name!: string // ชื่อหมวดหมู่ (แสดงผล)

    @Index()
    @Column({ name: "branch_id", type: "uuid", nullable: true })
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

    @OneToMany(() => Products, (products) => products.category)
    products!: Products[] // รายการสินค้าในหมวดหมู่นี้
}