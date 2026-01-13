import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { Payments } from "./Payments";

@Entity()
export class PaymentDetails {
    @PrimaryGeneratedColumn("uuid")
    id!: string; // รหัสอ้างอิงรายละเอียด

    @Column({ name: "payment_id", type: "uuid" })
    payment_id!: string; // รหัสการชำระเงินหลัก

    @ManyToOne(() => Payments, (payment) => payment.payment_details)
    @JoinColumn({ name: "payment_id" })
    payment!: Payments; // ความสัมพันธ์เชื่อมไปยังข้อมูลการชำระเงิน

    @Column({ type: "varchar", length: 100, nullable: true })
    ref_no!: string | null; // เลขที่อ้างอิง (เช่น เลข Slip, TxID)

    @Column({ type: "text", nullable: true })
    remarks!: string | null; // หมายเหตุเพิ่มเติม

    @Column({ type: "json", nullable: true })
    json_metadata!: any; // ข้อมูลดิบจากระบบชำระเงิน (JSON)

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date; // วันที่สร้างข้อมูล
}
