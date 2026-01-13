
import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { Tables } from "./Tables";
import { Delivery } from "./Delivery";
import { OrdersItem } from "./OrdersItem";
import { Payments } from "./Payment";
import { Discounts } from "./Discounts";
import { Users } from "../Users";

export enum OrderType {
    DineIn = "DineIn",      // ทานที่ร้าน
    TakeAway = "TakeAway",  // สั่งกลับบ้าน
    Delivery = "Delivery"   // เดลิเวอรี่
}

export enum OrderStatus {
    Pending = "Pending",    // รอรับออเดอร์
    Cooking = "Cooking",    // กำลังปรุงอาหาร
    Served = "Served",      // เสิร์ฟแล้ว
    Paid = "Paid",          // ชำระเงินแล้ว
    Cancelled = "Cancelled" // ยกเลิกออเดอร์
}

@Entity()
export class Orders {
    @PrimaryGeneratedColumn("uuid")
    id!: string; // รหัสอ้างอิงหลักของออเดอร์

    @Column({ type: "varchar", unique: true })
    order_no!: string; // เลขที่ออเดอร์ (เช่น ORD-20240501-001)

    @Column({ type: "enum", enum: OrderType })
    order_type!: OrderType; // ประเภทของออเดอร์ (ทานร้าน/กลับบ้าน/ส่ง)

    @Column({ name: "table_id", type: "uuid", nullable: true })
    table_id?: string | null; // รหัสโต๊ะ (กรณีทานที่ร้าน)

    @ManyToOne(() => Tables)
    @JoinColumn({ name: "table_id" })
    table?: Tables | null; // ความสัมพันธ์เชื่อมไปยังข้อมูลโต๊ะ

    @Column({ name: "delivery_id", type: "uuid", nullable: true })
    delivery_id?: string | null; // รหัสผู้ให้บริการส่งอาหาร (กรณีเดลิเวอรี่)

    @ManyToOne(() => Delivery)
    @JoinColumn({ name: "delivery_id" })
    delivery?: Delivery | null; // ความสัมพันธ์เชื่อมไปยังข้อมูลบริการส่งอาหาร

    @Column({ type: "varchar", length: 100, nullable: true })
    delivery_code?: string | null; // รหัสออเดอร์จากผู้ให้บริการ (เช่น Grab: GF-123)

    // --- ส่วนการเงิน ---
    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    sub_total!: number; // ยอดรวมค่าอาหาร (ก่อนหักส่วนลด/ภาษี)

    @Column({ name: "discount_id", type: "uuid", nullable: true })
    discount_id?: string | null; // รหัสส่วนลดที่ใช้ (ถ้ามี)

    @ManyToOne(() => Discounts)
    @JoinColumn({ name: "discount_id" })
    discount?: Discounts | null; // ความสัมพันธ์เชื่อมไปยังข้อมูลส่วนลด

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    discount_amount!: number; // มูลค่าส่วนลดรวม (บาท)

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    vat!: number; // ภาษีมูลค่าเพิ่ม

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    total_amount!: number; // ยอดสุทธิที่ต้องชำระ (Net Amount)

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    received_amount!: number; // ยอดเงินที่รับจากลูกค้า

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    change_amount!: number; // เงินทอน

    @Column({ type: "enum", enum: OrderStatus, default: OrderStatus.Pending })
    status!: OrderStatus; // สถานะของออเดอร์

    @Column({ name: "created_by_id", type: "uuid", nullable: true })
    created_by_id?: string | null; // รหัสพนักงานที่สร้างออเดอร์

    @ManyToOne(() => Users)
    @JoinColumn({ name: "created_by_id" })
    created_by?: Users | null; // ความสัมพันธ์เชื่อมไปยังข้อมูลพนักงาน

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date; // วันที่และเวลาที่สร้างออเดอร์

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    update_date!: Date; // วันที่และเวลาที่แก้ไขล่าสุด

    @OneToMany(() => OrdersItem, (item) => item.order)
    items!: OrdersItem[]; // รายการอาหารในออเดอร์นี้

    @OneToMany(() => Payments, (payment) => payment.order)
    payments!: Payments[]; // ประวัติการชำระเงินของออเดอร์นี้
}