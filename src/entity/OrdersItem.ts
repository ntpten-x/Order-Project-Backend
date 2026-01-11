import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToOne, Index } from "typeorm"
import { Ingredients } from "./Ingredients"
import { Orders } from "./Orders"
import { OrdersDetail } from "./OrdersDetail"

@Entity()
export class OrdersItem {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Index()
    @Column({ name: "ingredient_id", type: "uuid" })
    ingredient_id!: string

    @ManyToOne(() => Ingredients)
    @JoinColumn({ name: "ingredient_id" })
    ingredient!: Ingredients

    @Index()
    @Column({ name: "orders_id", type: "uuid" })
    orders_id!: string

    @ManyToOne(() => Orders, (orders) => orders.ordersItems, { onDelete: 'CASCADE' })
    @JoinColumn({ name: "orders_id" })
    orders!: Orders

    @Column({ name: "quantity_ordered", type: "int" })
    quantity_ordered!: number

    @OneToOne(() => OrdersDetail, (ordersDetail) => ordersDetail.ordersItem)
    ordersDetail!: OrdersDetail

}
