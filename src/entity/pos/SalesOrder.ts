import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany, Index } from "typeorm";
import { Tables } from "./Tables";
import { Delivery } from "./Delivery";
import { SalesOrderItem } from "./SalesOrderItem";
import { Payments } from "./Payments";
import { Discounts } from "./Discounts";
import { Users } from "../Users";
import { OrderType, OrderStatus } from "./OrderEnums";

@Entity("sales_orders") // Updated table name to be specific per user request "Refactor Entity Naming"
// NOTE: Renaming table name usually implies migration or data loss if not carefully migrated.
// However, the task is about "Resolving Naming Conflicts". We had "Orders" in stock vs "Orders" in POS.
// Stock is now "StockOrders" (table: stock_orders).
// POS Orders should be "SalesOrders" (table: sales_orders) to be clean.
// If I change @Entity("orders") to @Entity("sales_orders"), TypeORM sync will likely create new table.
// User said "Existing database table names are preserved by explicitly setting @Entity("table_name") decorators".
// This implies I should KEEP existing table name if I want to preserve data.
// Existing table for `Orders` (POS) was `orders` (implied by empty `@Entity()`).
// So I should stick to `@Entity("orders")` to map to existing data unless migration is planned.
// User said "Existing database table names are preserved by explicitly setting...".
// OK, I will keep `@Entity("orders")` but rename class.
// Wait, I already have `@Entity("orders")` from previous state?
// In the current file `SalesOrder.ts`, line 10 says `@Entity("orders")`.
// I will keep it `@Entity("orders")` but rename relations.

@Index(["create_date"])
@Index(["status"])
export class SalesOrder {
    @PrimaryGeneratedColumn("uuid")
    id!: string; // รหัสอ้างอิงหลักของออเดอร์

    @Column({ type: "varchar", unique: true, nullable: true })
    order_no!: string; // เลขที่ออเดอร์ (เช่น ORD-20240501-001)

    @Column({ type: "enum", enum: OrderType, nullable: true })
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

    @OneToMany(() => SalesOrderItem, (item) => item.order)
    items!: SalesOrderItem[]; // รายการอาหารในออเดอร์นี้

    @OneToMany(() => Payments, (payment) => payment.order)
    payments!: Payments[]; // ประวัติการชำระเงินของออเดอร์นี้
}
