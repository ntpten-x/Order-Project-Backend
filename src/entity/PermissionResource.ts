import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("permission_resources")
export class PermissionResource {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ name: "resource_key", type: "varchar", length: 120, unique: true })
    resource_key!: string;

    @Column({ name: "resource_name", type: "varchar", length: 180 })
    resource_name!: string;

    @Column({ name: "route_pattern", type: "varchar", length: 255, nullable: true })
    route_pattern?: string;

    @Column({ name: "resource_type", type: "varchar", length: 20 })
    resource_type!: string;

    @Column({ name: "parent_id", type: "uuid", nullable: true })
    parent_id?: string;

    @Column({ name: "sort_order", type: "int", default: 0 })
    sort_order!: number;

    @Column({ name: "is_active", type: "boolean", default: true })
    is_active!: boolean;

    @Column({ name: "created_at", type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    created_at!: Date;

    @Column({ name: "updated_at", type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    updated_at!: Date;
}
