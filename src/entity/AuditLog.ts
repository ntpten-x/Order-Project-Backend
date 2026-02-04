import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm";
import { AuditActionType } from "../utils/auditTypes";

@Entity("audit_logs")
@Index(["user_id", "created_at"])
@Index(["action_type", "created_at"])
@Index(["entity_type", "entity_id"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 50 })
  action_type!: AuditActionType;

  @Index()
  @Column({ type: "uuid", nullable: true })
  user_id?: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  username?: string;

  @Column({ type: "varchar", length: 50 })
  ip_address!: string;

  @Column({ type: "text", nullable: true })
  user_agent?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  entity_type?: string;

  @Index()
  @Column({ type: "uuid", nullable: true })
  entity_id?: string;

  @Column({ type: "uuid", nullable: true })
  branch_id?: string;

  @Column({ type: "jsonb", nullable: true })
  old_values?: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  new_values?: Record<string, any>;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  path?: string;

  @Column({ type: "varchar", length: 10, nullable: true })
  method?: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;
}

