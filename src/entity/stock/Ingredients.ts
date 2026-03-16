import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from "typeorm"
import { IngredientsUnit } from "./IngredientsUnit"
import { Branch } from "../Branch"
import { StockCategory } from "./Category"

@Entity("stock_ingredients")
@Index(["display_name", "branch_id"], { unique: true })
export class Ingredients {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 100 })
    display_name!: string

    @Index()
    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch

    @Column({ type: "text" })
    description!: string

    @Index()
    @Column({ type: "boolean", default: true })
    is_active!: boolean

    @Column({ type: "text", nullable: true })
    img_url!: string | null

    @Index()
    @Column({ name: "category_id", type: "uuid", nullable: true })
    category_id!: string | null

    @Index()
    @Column({ type: "uuid" })
    unit_id!: string

    @CreateDateColumn({ type: "timestamptz" })
    create_date!: Date

    @UpdateDateColumn({ type: "timestamptz" })
    update_date!: Date

    @ManyToOne(() => IngredientsUnit, (ingredientsUnit) => ingredientsUnit.ingredients)
    @JoinColumn({ name: "unit_id" })
    unit!: IngredientsUnit

    @ManyToOne(() => StockCategory, (category) => category.ingredients, { nullable: true })
    @JoinColumn({ name: "category_id" })
    category!: StockCategory | null

}
