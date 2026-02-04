import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany, Index } from "typeorm";
import { SalesOrder } from "./SalesOrder";
import { PaymentMethod } from "./PaymentMethod";
import { Shifts } from "./Shifts";
import { Branch } from "../Branch";

export enum PaymentStatus {
    Pending = "Pending",    // รอชำระ
    Success = "Success",    // สำเร็จ
    Failed = "Failed"       // ล้มเหลว
}

@Index(["payment_date"])
@Entity()
export class Payments {
    @PrimaryGeneratedColumn("uuid")
    id!: string; // รหัสอ้างอิงการชำระเงิน

    @Index()
    @Column({ name: "order_id", type: "uuid" })
    order_id!: string; // รหัสออเดอร์

    @ManyToOne(() => SalesOrder, (order) => order.payments)
    @JoinColumn({ name: "order_id" })
    order!: SalesOrder; // ความสัมพันธ์เชื่อมไปยังออเดอร์

    @Index()
    @Column({ name: "shift_id", type: "uuid", nullable: true })
    shift_id?: string; // รหัสกะ (Optional เพราะบางทีอาจจะยังไม่เริ่มกะหรือระบบเก่า)

    @ManyToOne(() => Shifts, (shift) => shift.payments)
    @JoinColumn({ name: "shift_id" })
    shift?: Shifts;

    @Column({ name: "payment_method_id", type: "uuid" })
    payment_method_id!: string; // รหัสวิธีการชำระเงิน

    @ManyToOne(() => PaymentMethod)
    @JoinColumn({ name: "payment_method_id" })
    payment_method!: PaymentMethod; // ความสัมพันธ์เชื่อมไปยังวิธีการชำระเงิน

    @Column({ type: "decimal", precision: 12, scale: 2 })
    amount!: number; // ยอดเงินที่ชำระในรายการนี้ (เช่น จ่ายบางส่วน 500 บาท)

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    amount_received!: number; // ยอดเงินที่รับมาจริง (เช่น รับมา 1000)

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    change_amount!: number; // เงินทอนสำหรับรายการนี้ (เช่น ทอน 500)

    @Column({ type: "enum", enum: PaymentStatus, default: PaymentStatus.Success })
    status!: PaymentStatus; // สถานะการชำระเงิน

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    payment_date!: Date; // วันที่และเวลาชำระเงิน

    @Index()
    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch;
}
