import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum TableStatus {
    Available = "Available",    // ว่าง
    Unavailable = "Unavailable" // ไม่ว่าง
}

@Entity()
export class Tables {
    @PrimaryGeneratedColumn("uuid")
    id!: string; // รหัสโต๊ะ

    @Column({ type: 'varchar', length: 255, unique: true })
    table_name!: string; // ชื่อโต๊ะ (เช่น T1, A10)

    @Column({ type: "enum", enum: TableStatus, default: TableStatus.Available })
    status!: TableStatus; // สถานะโต๊ะ

    @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    create_date!: Date; // วันที่สร้าง

    @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    update_date!: Date; // วันที่แก้ไขล่าสุด

    @Column({ type: 'boolean', default: true })
    is_active!: boolean; // สถานะการใช้งาน (เปิด/ปิด)
}