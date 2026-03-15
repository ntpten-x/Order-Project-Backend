import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { Branch } from "../Branch";
import { Ingredients } from "./Ingredients";

@Entity("stock_categories")
@Index(["display_name", "branch_id"], { unique: true })
export class StockCategory {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 100 })
    display_name!: string;

    @Index()
    @Column({ name: "branch_id", type: "uuid" })
    branch_id!: string;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch;

    @Index()
    @Column({ type: "boolean", default: true })
    is_active!: boolean;

    @CreateDateColumn({ type: "timestamptz" })
    create_date!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    update_date!: Date;

    @OneToMany(() => Ingredients, (ingredient) => ingredient.category)
    ingredients!: Ingredients[];
}
