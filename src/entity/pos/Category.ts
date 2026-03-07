import { Column, Entity, PrimaryGeneratedColumn, OneToMany, Index, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm"
import { Products } from "./Products"
import { Branch } from "../Branch"

@Entity()
@Index(["display_name", "branch_id"], { unique: true })
export class Category {
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

    @CreateDateColumn({ type: "timestamptz" })
    create_date!: Date

    @UpdateDateColumn({ type: "timestamptz" })
    update_date!: Date

    @Index()
    @Column({ type: "boolean", default: true })
    is_active!: boolean

    @OneToMany(() => Products, (products) => products.category)
    products!: Products[]
}
