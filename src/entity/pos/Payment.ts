import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { Orders } from "./Orders";
import { PaymentMethod } from "./PaymentMethod";
import { PaymentDetails } from "./PaymentDetails";

export enum PaymentStatus {
    Pending = "Pending",    // รอชำระ
    Success = "Success",    // สำเร็จ
    Failed = "Failed"       // ล้มเหลว
}

@Entity()
export class Payments {
    @PrimaryGeneratedColumn("uuid")
    id!: string; // รหัสอ้างอิงการชำระเงิน

    @Column({ name: "order_id", type: "uuid" })
    order_id!: string; // รหัสออเดอร์

    @ManyToOne(() => Orders, (order) => order.payments)
    @JoinColumn({ name: "order_id" })
    order!: Orders; // ความสัมพันธ์เชื่อมไปยังออเดอร์

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

    @OneToMany(() => PaymentDetails, (detail) => detail.payment)
    payment_details!: PaymentDetails[]; // รายละเอียดเพิ่มเติมการชำระเงิน
}