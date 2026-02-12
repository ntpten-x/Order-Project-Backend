import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("permission_actions")
export class PermissionAction {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ name: "action_key", type: "varchar", length: 80, unique: true })
    action_key!: string;

    @Column({ name: "action_name", type: "varchar", length: 120 })
    action_name!: string;

    @Column({ name: "is_active", type: "boolean", default: true })
    is_active!: boolean;
}
