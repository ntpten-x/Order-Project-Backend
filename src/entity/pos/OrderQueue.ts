import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index, CreateDateColumn } from "typeorm";
import { SalesOrder } from "./SalesOrder";
import { Branch } from "../Branch";

export enum QueueStatus {
    Pending = "Pending",      // รอในคิว
    Processing = "Processing", // กำลังดำเนินการ
    Completed = "Completed",   // เสร็จสิ้น
    Cancelled = "Cancelled"    // ยกเลิก
}

export enum QueuePriority {
    Low = "Low",           // ลำดับความสำคัญต่ำ
    Normal = "Normal",     // ปกติ
    High = "High",         // สูง
    Urgent = "Urgent"      // ด่วน
}

@Entity("order_queue")
@Index(["order_id"], { unique: true })
@Index(["branch_id", "status"])
@Index(["priority", "created_at"])
export class OrderQueue {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ name: "order_id", type: "uuid" })
    order_id!: string;

    @ManyToOne(() => SalesOrder)
    @JoinColumn({ name: "order_id" })
    order?: SalesOrder;

    @Index()
    @Column({ name: "branch_id", type: "uuid", nullable: true })
    branch_id?: string;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch;

    @Column({ type: "enum", enum: QueueStatus, default: QueueStatus.Pending })
    status!: QueueStatus;

    @Column({ type: "enum", enum: QueuePriority, default: QueuePriority.Normal })
    priority!: QueuePriority;

    @Column({ type: "integer", default: 0 })
    queue_position!: number; // ตำแหน่งในคิว

    @Column({ type: "timestamptz", nullable: true })
    started_at?: Date; // เวลาที่เริ่มดำเนินการ

    @Column({ type: "timestamptz", nullable: true })
    completed_at?: Date; // เวลาที่เสร็จสิ้น

    @Column({ type: "text", nullable: true })
    notes?: string; // หมายเหตุ

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;
}
