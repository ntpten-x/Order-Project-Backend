import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Index } from "typeorm"
import { Roles } from "./Roles"
import { Branch } from "./Branch"

@Entity()
export class Users {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 100, unique: true })
    username!: string

    @Column({ type: "varchar", length: 100, nullable: true })
    name?: string

    @Column({ type: "varchar", length: 100 })
    password!: string

    @CreateDateColumn({ type: "timestamptz" })
    create_date!: Date

    @Column({ type: "timestamptz", nullable: true })
    last_login_at!: Date

    @Index()
    @Column({ name: "roles_id", type: "uuid" })
    roles_id!: string

    @Index()
    @Column({ type: "boolean", default: true })
    is_use!: boolean

    @Index()
    @Column({ type: "boolean", default: false })
    is_active!: boolean

    @ManyToOne(() => Roles, (roles) => roles.users)
    @JoinColumn({ name: "roles_id" })
    roles!: Roles

    @Index()
    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch
}
