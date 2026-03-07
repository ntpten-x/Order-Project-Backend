import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from "typeorm"
import { Category } from "./Category"
import { ProductsUnit } from "./ProductsUnit"
import { Branch } from "../Branch"

@Entity()
@Index(["branch_id"])
@Index(["display_name"])
export class Products {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch

    @Column({ type: "varchar", length: 100 })
    display_name!: string

    @Column({ type: "text" })
    description!: string

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    price!: number

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    cost!: number

    @Column({ name: "price_delivery", type: "decimal", precision: 12, scale: 2, default: 0 })
    price_delivery!: number

    @Index()
    @Column({ name: "category_id", type: "uuid" })
    category_id!: string

    @Index()
    @Column({ name: "unit_id", type: "uuid" })
    unit_id!: string

    @Column({ type: "text", nullable: true })
    img_url!: string | null

    @CreateDateColumn({ type: "timestamptz" })
    create_date!: Date

    @UpdateDateColumn({ type: "timestamptz" })
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
