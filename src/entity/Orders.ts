import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { Users } from "./Users"
import { OrdersItem } from "./OrdersItem"

export enum OrderStatus {
    PENDING = "pending",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}

@Entity()
export class Orders {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @ManyToOne(() => Users)
    @JoinColumn({ name: "ordered_by_id" })
    ordered_by!: Users

    @Column({ name: "ordered_by_id", type: "uuid" })
    ordered_by_id!: string

    @Column({
        type: "enum",
        enum: OrderStatus,
        default: OrderStatus.PENDING
    })
    status!: OrderStatus

    @CreateDateColumn({ type: "timestamptz" })
    create_date!: Date

    @UpdateDateColumn({ type: "timestamptz" })
    update_date!: Date

    @OneToMany(() => OrdersItem, (ordersItem) => ordersItem.orders)
    ordersItems!: OrdersItem[]
}
