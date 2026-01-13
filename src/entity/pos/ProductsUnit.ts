import { Column, Entity, PrimaryGeneratedColumn, OneToMany, Index } from "typeorm"
import { Products } from "./Products"

@Entity()
export class ProductsUnit {
    @PrimaryGeneratedColumn("uuid")
    id!: string // รหัสหน่วยสินค้า

    @Column({ type: "varchar", length: 100, unique: true })
    unit_name!: string // ชื่อหน่วย (ระบบ)

    @Column({ type: "varchar", length: 100, unique: true })
    display_name!: string // ชื่อหน่วย (แสดงผล)

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
