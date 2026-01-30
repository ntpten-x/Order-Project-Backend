import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from "typeorm"
import { Users } from "../Users"
import { StockOrdersItem } from "./OrdersItem"
import { Branch } from "../Branch"

export enum PurchaseOrderStatus {
    PENDING = "pending",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}

@Entity("stock_orders") // Kept "stock_orders" table to preserve data
// If I change @Entity("stock_orders") to @Entity("purchase_orders"), it might drop data if sync is on.
// Safest is to keep table name "stock_orders" BUT rename Entity to PurchaseOrder.
// User said "Entity Name".
// Let's stick to "stock_orders" table for now to preserve data, OR ask user. 
// Given "I want to resolve naming conflict", the TypeScript class name is key.
// But if I want to be thorough, I should rename table too.
// However, `stock_orders` table name is fine.
@Index("IDX_STOCK_ORDERS_STATUS_DATE", ["status", "create_date"])
export class PurchaseOrder {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @ManyToOne(() => Users)
    @JoinColumn({ name: "ordered_by_id" })
    ordered_by!: Users

    @Column({ name: "ordered_by_id", type: "uuid" })
    ordered_by_id!: string

    @Column({ type: "text", nullable: true })
    remark?: string

    @Index()
    @Column({ name: "branch_id", type: "uuid", nullable: true })
    branch_id?: string

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch

    @Index()
    @Column({
        type: "enum",
        enum: PurchaseOrderStatus,
        default: PurchaseOrderStatus.PENDING
    })
    status!: PurchaseOrderStatus

    @CreateDateColumn({ type: "timestamptz" })
    create_date!: Date

    @UpdateDateColumn({ type: "timestamptz" })
    update_date!: Date

    // I need to update StockOrdersItem relation too.
    @OneToMany(() => StockOrdersItem, (ordersItem) => ordersItem.orders)
    // This relation name in OrdersItem is likely 'orders'. I should probably update that too? 
    // Just renaming Entity first.
    ordersItems!: StockOrdersItem[]
}
