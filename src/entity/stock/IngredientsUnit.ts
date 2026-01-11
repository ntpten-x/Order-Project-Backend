import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index } from "typeorm"
import { Ingredients } from "./Ingredients"

@Entity()
export class IngredientsUnit {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 100, unique: true })
    unit_name!: string

    @Column({ type: "varchar", length: 100, unique: true })
    display_name!: string

    @Index()
    @Column({ type: "boolean", default: true })
    is_active!: boolean

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date

    @OneToMany(() => Ingredients, (ingredients) => ingredients.unit)
    ingredients!: Ingredients[]
}