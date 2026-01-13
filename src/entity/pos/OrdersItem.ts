import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { Orders } from "./Orders";
import { Products } from "./Products";
import { OrdersDetail } from "./OrdersDetail";

@Entity()
export class OrdersItem {
    @PrimaryGeneratedColumn("uuid")
    id!: string; // รหัสอ้างอิงรายการสินค้าในบิล

    @Column({ name: "order_id", type: "uuid" })
    order_id!: string; // รหัสออเดอร์หลัก

    @ManyToOne(() => Orders, (order) => order.items)
    @JoinColumn({ name: "order_id" })
    order!: Orders; // ความสัมพันธ์เชื่อมไปยังออเดอร์

    @Column({ name: "product_id", type: "uuid" })
    product_id!: string; // รหัสสินค้า

    @ManyToOne(() => Products)
    @JoinColumn({ name: "product_id" })
    product!: Products; // ความสัมพันธ์เชื่อมไปยังข้อมูลสินค้า

    @Column({ type: "int", default: 1 })
    quantity!: number; // จำนวนที่สั่ง

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    price!: number; // ราคาต่อหน่วย ณ เวลาที่ขาย (Snapshot Price)

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    discount_amount!: number; // ส่วนลดเฉพาะรายการนี้ (บาท)

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    total_price!: number; // ราคารวมของรายการนี้ ((ราคา * จำนวน) - ส่วนลด + เพิ่มเติม)

    @Column({ type: "text", nullable: true })
    notes?: string; // หมายเหตุเพิ่มเติม (เช่น ไม่ใส่ผัก, เผ็ดน้อย)

    @OneToMany(() => OrdersDetail, (detail) => detail.orders_item)
    details!: OrdersDetail[]; // รายละเอียดเพิ่มเติม (Modifiers) เช่น ท็อปปิ้ง
}