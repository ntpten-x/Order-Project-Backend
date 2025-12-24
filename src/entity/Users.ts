import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm"
import { Roles } from "./Roles"

@Entity()
export class Users {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: "varchar", length: 100, unique: true })
    username!: string

    @Column({ type: "varchar", length: 100 })
    password!: string

    @Column({ name: "roles_id" })
    roles_id!: number

    @ManyToOne(() => Roles, (roles) => roles.users)
    @JoinColumn({ name: "roles_id" })
    roles!: Roles
}