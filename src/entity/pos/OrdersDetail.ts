import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { OrdersItem } from "./OrdersItem";

@Entity()
export class OrdersDetail {
    @PrimaryGeneratedColumn("uuid")
    id!: string; // รหัสอ้างอิงรายละเอียดเพิ่มเติม

    @Column({ name: "orders_item_id", type: "uuid" })
    orders_item_id!: string; // รหัสรายการสินค้าแม่ข่าย

    @ManyToOne(() => OrdersItem, (item) => item.details)
    @JoinColumn({ name: "orders_item_id" })
    orders_item!: OrdersItem; // ความสัมพันธ์เชื่อมไปยังรายการสินค้า

    @Column({ type: "varchar", length: 255 })
    detail_name!: string; // ชื่อรายละเอียด (เช่น "หวาน 50%", "เพิ่มชีส")

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    extra_price!: number; // ราคาที่เพิ่มขึ้น (เช่น +5.00 บาท)

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date; // วันที่สร้างข้อมูล
}