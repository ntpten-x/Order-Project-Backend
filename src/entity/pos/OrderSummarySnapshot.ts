import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { OrderStatus, OrderType } from "./OrderEnums";

@Entity("order_summary_snapshots")
@Index(["branch_id", "status", "order_type", "create_date"])
@Index(["branch_id", "create_date"])
@Index(["created_by_id"])
export class OrderSummarySnapshot {
    @PrimaryColumn({ name: "order_id", type: "uuid" })
    order_id!: string;

    @Column({ name: "branch_id", type: "uuid" })
    branch_id!: string;

    @Column({ name: "created_by_id", type: "uuid", nullable: true })
    created_by_id?: string | null;

    @Column({ type: "varchar", nullable: true })
    order_no!: string | null;

    @Column({ type: "enum", enum: OrderType })
    order_type!: OrderType;

    @Column({ type: "enum", enum: OrderStatus })
    status!: OrderStatus;

    @Column({ type: "timestamptz" })
    create_date!: Date;

    @Column({ type: "timestamptz" })
    update_date!: Date;

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    total_amount!: number;

    @Column({ type: "varchar", length: 100, nullable: true })
    delivery_code?: string | null;

    @Column({ type: "varchar", length: 120, nullable: true })
    customer_name?: string | null;

    @Column({ name: "table_id", type: "uuid", nullable: true })
    table_id?: string | null;

    @Column({ type: "varchar", length: 255, nullable: true })
    table_name?: string | null;

    @Column({ name: "delivery_id", type: "uuid", nullable: true })
    delivery_id?: string | null;

    @Column({ type: "varchar", length: 255, nullable: true })
    delivery_name?: string | null;

    @Column({ type: "text", nullable: true })
    delivery_logo?: string | null;

    @Column({ type: "int", default: 0 })
    items_count!: number;
}
