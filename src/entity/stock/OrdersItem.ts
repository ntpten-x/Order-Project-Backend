import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToOne, Index } from "typeorm"
import { Ingredients } from "./Ingredients"
import { PurchaseOrder } from "./PurchaseOrder"
import { StockOrdersDetail } from "./OrdersDetail"

@Entity("stock_orders_item")
export class StockOrdersItem {
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

    @ManyToOne(() => PurchaseOrder, (orders) => orders.ordersItems, { onDelete: 'CASCADE' })
    @JoinColumn({ name: "orders_id" })
    orders!: PurchaseOrder

    @Column({ name: "quantity_ordered", type: "int" })
    quantity_ordered!: number

    @OneToOne(() => StockOrdersDetail, (ordersDetail) => ordersDetail.ordersItem)
    ordersDetail!: StockOrdersDetail

}
