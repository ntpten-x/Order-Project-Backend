import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, UpdateDateColumn, Index } from "typeorm";
import { Branch } from "../Branch";
import { Ingredients } from "./Ingredients";

@Entity("branch_stock")
@Index(["branch_id", "ingredient_id"], { unique: true })
export class BranchStock {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ name: "branch_id", type: "uuid" })
    branch_id!: string;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch!: Branch;

    @Column({ name: "ingredient_id", type: "uuid" })
    ingredient_id!: string;

    @ManyToOne(() => Ingredients)
    @JoinColumn({ name: "ingredient_id" })
    ingredient!: Ingredients;

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    quantity!: number;

    @UpdateDateColumn({ type: "timestamptz" })
    last_updated!: Date;
}
