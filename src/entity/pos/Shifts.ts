
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, JoinColumn, ManyToOne, Index } from "typeorm";
import { Users } from "../Users"; // Assuming Users entity is in src/entity/Users.ts or similar. I'll check Users location first actually.
import { Payments } from "./Payments";

export enum ShiftStatus {
    OPEN = "OPEN",
    CLOSED = "CLOSED"
}

@Entity()
export class Shifts {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index()
    @Column({ name: "user_id", type: "uuid" })
    user_id!: string;

    // Use string relations for now to avoid circular deps ambiguity mostly
    @ManyToOne("Users")
    @JoinColumn({ name: "user_id" })
    user!: any; // Users type

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    start_amount!: number; // เงินทอนเริ่มต้น

    @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
    end_amount?: number; // เงินที่นับได้จริงตอนปิดกะ

    @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
    expected_amount?: number; // ยอดที่ระบบคำนวณได้ (Start + Sales)

    @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
    diff_amount?: number; // ผลต่าง (End - Expected)

    @Index()
    @Column({ type: "enum", enum: ShiftStatus, default: ShiftStatus.OPEN })
    status!: ShiftStatus;

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    open_time!: Date;

    @Column({ type: "timestamptz", nullable: true })
    close_time?: Date;

    @OneToMany(() => Payments, (payment) => payment.shift)
    payments!: Payments[];

    @CreateDateColumn()
    create_date!: Date;

    @UpdateDateColumn()
    update_date!: Date;
}
