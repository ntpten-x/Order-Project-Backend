import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from "typeorm"
import { IngredientsUnit } from "./IngredientsUnit"
import { Branch } from "../Branch"

@Entity("stock_ingredients")
@Index(["ingredient_name", "branch_id"], { unique: true })
@Index(["display_name", "branch_id"], { unique: true })
export class Ingredients {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 100 })
    ingredient_name!: string

    @Column({ type: "varchar", length: 100 })
    display_name!: string

    @Index()
    @Column({ name: "branch_id", type: "uuid", nullable: true })
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
    @Column({ type: "uuid" })
    unit_id!: string

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date

    @ManyToOne(() => IngredientsUnit, (ingredientsUnit) => ingredientsUnit.ingredients)
    @JoinColumn({ name: "unit_id" })
    unit!: IngredientsUnit

}