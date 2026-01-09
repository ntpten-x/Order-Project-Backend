import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm"
import { IngredientsUnit } from "./IngredientsUnit"

@Entity()
export class Ingredients {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 100, unique: true })
    ingredient_name!: string

    @Column({ type: "varchar", length: 100, unique: true })
    display_name!: string

    @Column({ type: "text" })
    description!: string

    @Column({ type: "boolean", default: true })
    is_active!: boolean

    @Column({ type: "text", nullable: true })
    img_url!: string | null

    @Column({ type: "uuid" })
    unit_id!: string

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date

    @ManyToOne(() => IngredientsUnit, (ingredientsUnit) => ingredientsUnit.ingredients)
    @JoinColumn({ name: "unit_id" })
    unit!: IngredientsUnit

}