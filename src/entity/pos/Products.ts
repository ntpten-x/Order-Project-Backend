import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from "typeorm"
import { Category } from "./Category"
import { ProductsUnit } from "./ProductsUnit"

@Entity()
export class Products {
    @PrimaryGeneratedColumn("uuid")
    id!: string // รหัสสินค้า

    @Index()
    @Column({ type: "varchar", length: 100 })
    product_name!: string // ชื่อสินค้า (ระบบ)

    @Column({ type: "varchar", length: 100 })
    display_name!: string // ชื่อสินค้า (แสดงผล)

    @Column({ type: "text" })
    description!: string // รายละเอียดสินค้า

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    price!: number // ราคาสินค้า

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    cost!: number // ต้นทุนสินค้า

    @Index()
    @Column({ name: "category_id", type: "uuid" })
    category_id!: string // รหัสหมวดหมู่

    @Index()
    @Column({ name: "unit_id", type: "uuid" })
    unit_id!: string // รหัสหน่วยสินค้า

    @Column({ type: "text", nullable: true })
    img_url!: string | null // URL รูปภาพสินค้า

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date // วันที่สร้าง

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    update_date!: Date // วันที่แก้ไขล่าสุด

    @Index()
    @Column({ type: "boolean", default: true })
    is_active!: boolean // สถานะการใช้งาน

    @ManyToOne(() => Category, (category) => category.products)
    @JoinColumn({ name: "category_id" })
    category!: Category // ความสัมพันธ์เชื่อมไปยังหมวดหมู่

    @ManyToOne(() => ProductsUnit, (productsUnit) => productsUnit.products)
    @JoinColumn({ name: "unit_id" })
    unit!: ProductsUnit // ความสัมพันธ์เชื่อมไปยังหน่วยสินค้า
}