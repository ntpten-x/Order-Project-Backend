import { Column, Entity, PrimaryGeneratedColumn, Index } from "typeorm";
import { OrderType, OrderStatus } from "./OrderEnums";

@Entity()
@Index(["create_date"])
@Index(["end_date"])
@Index(["status"])
export class PosHistory {
    @PrimaryGeneratedColumn("uuid")
    id!: string; // รหัสอ้างอิงประวัติ

    @Column({ name: "order_id", type: "uuid", nullable: true })
    order_id?: string; // รหัสออเดอร์เดิม (Reference)

    @Column({ type: "varchar", nullable: true })
    order_no!: string; // เลขที่ออเดอร์

    @Column({ type: "enum", enum: OrderType, nullable: true })
    order_type!: OrderType; // ประเภทของออเดอร์

    // Store IDs only, no FK constraints to allow deletions of original data if needed, 
    // or keep FK if we want integrity. For history, usually loose coupling is better or Snapshot data.
    @Column({ name: "table_id", type: "uuid", nullable: true })
    table_id?: string | null;

    @Column({ name: "delivery_id", type: "uuid", nullable: true })
    delivery_id?: string | null;

    @Column({ name: "created_by_id", type: "uuid", nullable: true })
    created_by_id?: string | null;

    // Financials
    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    sub_total!: number;

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    discount_amount!: number;

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    vat!: number;

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    total_amount!: number;

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    received_amount!: number;

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    change_amount!: number;

    @Column({ type: "enum", enum: OrderStatus })
    status!: OrderStatus;

    // Dates
    @Column({ type: "timestamptz" })
    create_date!: Date; // วันที่สร้างออเดอร์เดิม

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    end_date!: Date; // วันที่จบออเดอร์/ย้ายเข้าประวัติ

    // Snapshots (JSON)
    @Column({ type: "jsonb", nullable: true })
    items_snapshot?: any; // เก็บข้อมูล items ทั้งหมดในรูปแบบ JSON ณ เวลาที่จบ

    @Column({ type: "jsonb", nullable: true })
    payments_snapshot?: any; // เก็บข้อมูลการชำระเงินทั้งหมด

    @Column({ type: "jsonb", nullable: true })
    additional_data?: any; // ข้อมูลอื่นๆ เช่น ชื่อลูกค้า, delivery address snapshot
}
