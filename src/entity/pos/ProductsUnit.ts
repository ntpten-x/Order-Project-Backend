import { Column, Entity, PrimaryGeneratedColumn, OneToMany, Index } from "typeorm"
import { Products } from "./Products"

@Entity()
export class ProductsUnit {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 100, unique: true })
    unit_name!: string

    @Column({ type: "varchar", length: 100, unique: true })
    display_name!: string

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    update_date!: Date

    @Index()
    @Column({ type: "boolean", default: true })
    is_active!: boolean

    @OneToMany(() => Products, (products) => products.unit)
    products!: Products[]
}
