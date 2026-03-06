import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany, Index } from "typeorm";
import { SalesOrder } from "./SalesOrder";
import { OrderStatus, ServingStatus } from "./OrderEnums";
import { Products } from "./Products";
import { SalesOrderDetail } from "./SalesOrderDetail";

@Entity("sales_order_item")
export class SalesOrderItem {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index()
    @Column({ name: "order_id", type: "uuid", nullable: true })
    order_id!: string;

    @ManyToOne(() => SalesOrder, (order) => order.items)
    @JoinColumn({ name: "order_id" })
    order!: SalesOrder;

    @Column({ name: "product_id", type: "uuid", nullable: true })
    product_id!: string;

    @ManyToOne(() => Products)
    @JoinColumn({ name: "product_id" })
    product!: Products;

    @Column({ type: "int", default: 1 })
    quantity!: number;

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    price!: number;

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    discount_amount!: number;

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    total_price!: number;

    @Column({ type: "text", nullable: true })
    notes?: string;

    @Index()
    @Column({
        name: "serving_group_id",
        type: "uuid",
        default: () => "gen_random_uuid()",
    })
    serving_group_id!: string;

    @Index()
    @Column({
        name: "serving_group_created_at",
        type: "timestamptz",
        default: () => "CURRENT_TIMESTAMP",
    })
    serving_group_created_at!: Date;

    @Index()
    @Column({
        name: "serving_status",
        type: "varchar",
        length: 32,
        default: ServingStatus.PendingServe,
    })
    serving_status!: ServingStatus;

    @Index()
    @Column({ type: "enum", enum: OrderStatus, default: OrderStatus.Pending })
    status!: OrderStatus;

    @OneToMany(() => SalesOrderDetail, (detail) => detail.sales_order_item)
    details!: SalesOrderDetail[];
}
