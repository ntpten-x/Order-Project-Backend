import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from "typeorm"
import { Users } from "./Users"

@Entity()
export class Roles {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ type: "varchar", length: 100, unique: true })
    roles_name!: string

    @Column({ type: "varchar", length: 100, unique: true })
    display_name!: string

    @OneToMany(() => Users, (users) => users.roles)
    users!: Users[]
}