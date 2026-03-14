import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Index } from "typeorm";
import { SalesOrderItem } from "./SalesOrderItem";
import { Topping } from "./Topping";

@Entity("sales_order_detail")
export class SalesOrderDetail {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ name: "orders_item_id", type: "uuid" })
    orders_item_id!: string;

    @ManyToOne(() => SalesOrderItem, (item) => item.details)
    @JoinColumn({ name: "orders_item_id" })
    sales_order_item!: SalesOrderItem;

    @Index()
    @Column({ name: "topping_id", type: "uuid", nullable: true })
    topping_id!: string | null;

    @ManyToOne(() => Topping, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "topping_id" })
    topping!: Topping | null;

    @Column({ type: "varchar", length: 255, default: "" })
    detail_name!: string;

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    extra_price!: number;

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date;
}
