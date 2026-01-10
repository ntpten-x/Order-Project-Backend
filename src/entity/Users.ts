import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm"
import { Roles } from "./Roles"

@Entity()
export class Users {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 100, unique: true })
    username!: string

    @Column({ type: "varchar", length: 100 })
    password!: string

    @CreateDateColumn({ type: "timestamptz" })
    create_date!: Date

    @Column({ type: "timestamptz", nullable: true })
    last_login_at!: Date

    @Column({ default: true })
    is_use!: boolean

    @Column({ default: false })
    is_active!: boolean

    @Column({ name: "roles_id", type: "uuid" })
    roles_id!: string

    @ManyToOne(() => Roles, (roles) => roles.users)
    @JoinColumn({ name: "roles_id" })
    roles!: Roles
}