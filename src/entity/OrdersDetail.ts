import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn, ManyToOne, CreateDateColumn } from "typeorm"
import { OrdersItem } from "./OrdersItem"
import { Users } from "./Users"

@Entity()
export class OrdersDetail {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ name: "orders_item_id", type: "uuid", unique: true })
    orders_item_id!: string

    @OneToOne(() => OrdersItem, (ordersItem) => ordersItem.ordersDetail, { onDelete: 'CASCADE' })
    @JoinColumn({ name: "orders_item_id" })
    ordersItem!: OrdersItem

    @Column({ name: "actual_quantity", type: "int", nullable: true })
    actual_quantity!: number

    @Column({ name: "purchased_by_id", type: "uuid", nullable: true })
    purchased_by_id!: string | null

    @ManyToOne(() => Users, { nullable: true })
    @JoinColumn({ name: "purchased_by_id" })
    purchased_by!: Users | null

    @Column({ name: "is_purchased", type: "boolean", default: false })
    is_purchased!: boolean

    @CreateDateColumn({ type: "timestamptz" })
    create_date!: Date
}
