import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from "typeorm"
import { Category } from "./Category"
import { ProductsUnit } from "./ProductsUnit"

@Entity()
export class Products {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 100 })
    product_name!: string

    @Column({ type: "varchar", length: 100 })
    display_name!: string

    @Column({ type: "text" })
    description!: string

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    price!: number

    @Index()
    @Column({ name: "category_id", type: "uuid" })
    category_id!: string

    @Index()
    @Column({ name: "unit_id", type: "uuid" })
    unit_id!: string

    @Column({ type: "text", nullable: true })
    img_url!: string | null

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    update_date!: Date

    @Index()
    @Column({ type: "boolean", default: true })
    is_active!: boolean

    @ManyToOne(() => Category, (category) => category.products)
    @JoinColumn({ name: "category_id" })
    category!: Category

    @ManyToOne(() => ProductsUnit, (productsUnit) => productsUnit.products)
    @JoinColumn({ name: "unit_id" })
    unit!: ProductsUnit
}