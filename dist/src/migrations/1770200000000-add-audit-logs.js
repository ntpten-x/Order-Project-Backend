"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddAuditLogs1770200000000 = void 0;
const typeorm_1 = require("typeorm");
class AddAuditLogs1770200000000 {
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if table already exists
            const table = yield queryRunner.getTable("audit_logs");
            if (table) {
                console.log("audit_logs table already exists, skipping migration");
                return;
            }
            yield queryRunner.createTable(new typeorm_1.Table({
                name: "audit_logs",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()",
                    },
                    {
                        name: "action_type",
                        type: "varchar",
                        length: "50",
                    },
                    {
                        name: "user_id",
                        type: "uuid",
                        isNullable: true,
                    },
                    {
                        name: "username",
                        type: "varchar",
                        length: "200",
                        isNullable: true,
                    },
                    {
                        name: "ip_address",
                        type: "varchar",
                        length: "50",
                    },
                    {
                        name: "user_agent",
                        type: "text",
                        isNullable: true,
                    },
                    {
                        name: "entity_type",
                        type: "varchar",
                        length: "100",
                        isNullable: true,
                    },
                    {
                        name: "entity_id",
                        type: "uuid",
                        isNullable: true,
                    },
                    {
                        name: "branch_id",
                        type: "uuid",
                        isNullable: true,
                    },
                    {
                        name: "old_values",
                        type: "jsonb",
                        isNullable: true,
                    },
                    {
                        name: "new_values",
                        type: "jsonb",
                        isNullable: true,
                    },
                    {
                        name: "description",
                        type: "text",
                        isNullable: true,
                    },
                    {
                        name: "path",
                        type: "varchar",
                        length: "500",
                        isNullable: true,
                    },
                    {
                        name: "method",
                        type: "varchar",
                        length: "10",
                        isNullable: true,
                    },
                    {
                        name: "created_at",
                        type: "timestamptz",
                        default: "CURRENT_TIMESTAMP",
                    },
                ],
            }), true);
            // Create indexes
            yield queryRunner.createIndex("audit_logs", new typeorm_1.TableIndex({
                name: "IDX_audit_logs_user_id_created_at",
                columnNames: ["user_id", "created_at"],
            }));
            yield queryRunner.createIndex("audit_logs", new typeorm_1.TableIndex({
                name: "IDX_audit_logs_action_type_created_at",
                columnNames: ["action_type", "created_at"],
            }));
            yield queryRunner.createIndex("audit_logs", new typeorm_1.TableIndex({
                name: "IDX_audit_logs_entity_type_entity_id",
                columnNames: ["entity_type", "entity_id"],
            }));
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.dropTable("audit_logs");
        });
    }
}
exports.AddAuditLogs1770200000000 = AddAuditLogs1770200000000;
