import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Delivery {
    @PrimaryGeneratedColumn("uuid")
    id!: string; // รหัสอ้างอิงบริการส่ง

    @Column({ type: 'varchar', length: 255 })
    delivery_name!: string; // ชื่อบริการส่ง (เช่น Grab, Lineman)

    @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    create_date!: Date; // วันที่สร้าง

    @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    update_date!: Date; // วันที่แก้ไข

    @Column({ type: 'boolean', default: true })
    is_active!: boolean; // สถานะการใช้งาน
}