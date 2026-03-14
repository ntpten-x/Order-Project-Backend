import {
    Column,
    Entity,
    PrimaryGeneratedColumn,
    Index,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToMany,
    JoinTable,
} from "typeorm"

import { Branch } from "../Branch"
import { Category } from "./Category"
import { ToppingGroup } from "./ToppingGroup"

@Entity("topping")
@Index(["display_name", "branch_id"], { unique: true })
export class Topping {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 100 })
    display_name!: string

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    price!: number

    @Column({ name: "price_delivery", type: "decimal", precision: 12, scale: 2, default: 0 })
    price_delivery!: number

    @Column({ type: "text", nullable: true })
    img!: string | null

    @ManyToMany(() => Category, (category) => category.toppings)
    @JoinTable({
        name: "topping_categories",
        joinColumn: { name: "topping_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "category_id", referencedColumnName: "id" },
    })
    categories!: Category[]

    @ManyToMany(() => ToppingGroup, (toppingGroup) => toppingGroup.toppings)
    @JoinTable({
        name: "topping_group_toppings",
        joinColumn: { name: "topping_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "topping_group_id", referencedColumnName: "id" },
    })
    topping_groups!: ToppingGroup[]

    @Index()
    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch

    @CreateDateColumn({ type: "timestamptz" })
    create_date!: Date

    @UpdateDateColumn({ type: "timestamptz" })
    update_date!: Date

    @Index()
    @Column({ type: "boolean", default: true })
    is_active!: boolean
}
