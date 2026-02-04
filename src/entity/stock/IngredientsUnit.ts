import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index, ManyToOne, JoinColumn } from "typeorm"
import { Ingredients } from "./Ingredients"
import { Branch } from "../Branch"

@Entity("stock_ingredients_unit")
@Index(["unit_name", "branch_id"], { unique: true })
@Index(["display_name", "branch_id"], { unique: true })
export class IngredientsUnit {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 100 })
    unit_name!: string

    @Column({ type: "varchar", length: 100 })
    display_name!: string

    @Index()
    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch

    @Index()
    @Column({ type: "boolean", default: true })
    is_active!: boolean

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date

    @OneToMany(() => Ingredients, (ingredients) => ingredients.unit)
    ingredients!: Ingredients[]
}
