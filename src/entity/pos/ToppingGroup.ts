import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";

import { Branch } from "../Branch";
import { Products } from "./Products";
import { Topping } from "./Topping";

@Entity("topping_group")
@Index(["display_name", "branch_id"], { unique: true })
export class ToppingGroup {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 100 })
    display_name!: string;

    @Index()
    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch;

    @CreateDateColumn({ type: "timestamptz" })
    create_date!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    update_date!: Date;

    @Index()
    @Column({ type: "boolean", default: true })
    is_active!: boolean;

    @ManyToMany(() => Products, (product) => product.topping_groups)
    products!: Products[];

    @ManyToMany(() => Topping, (topping) => topping.topping_groups)
    toppings!: Topping[];
}
