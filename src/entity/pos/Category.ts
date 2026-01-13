import { Column, Entity, PrimaryGeneratedColumn, OneToMany, Index } from "typeorm"
import { Products } from "./Products"

@Entity()
export class Category {
    @PrimaryGeneratedColumn("uuid")
    id!: string // รหัสหมวดหมู่

    @Column({ type: "varchar", length: 100, unique: true })
    category_name!: string // ชื่อหมวดหมู่ (ระบบ)

    @Column({ type: "varchar", length: 100, unique: true })
    display_name!: string // ชื่อหมวดหมู่ (แสดงผล)

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