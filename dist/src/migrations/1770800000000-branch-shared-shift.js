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
exports.BranchSharedShift1770800000000 = void 0;
class BranchSharedShift1770800000000 {
    constructor() {
        this.name = "BranchSharedShift1770800000000";
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "opened_by_user_id" uuid`);
            yield queryRunner.query(`ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "closed_by_user_id" uuid`);
            yield queryRunner.query(`
            UPDATE "shifts"
            SET "opened_by_user_id" = "user_id"
            WHERE "opened_by_user_id" IS NULL
        `);
            // Keep only one active shift per branch by closing older duplicates.
            yield queryRunner.query(`
            WITH ranked_open AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY branch_id
                        ORDER BY open_time DESC, create_date DESC, id DESC
                    ) AS rn
                FROM shifts
                WHERE status = 'OPEN'
            )
            UPDATE shifts s
            SET
                status = 'CLOSED',
                close_time = COALESCE(s.close_time, NOW()),
                closed_by_user_id = COALESCE(s.closed_by_user_id, s.opened_by_user_id, s.user_id),
                update_date = NOW()
            FROM ranked_open r
            WHERE s.id = r.id
              AND r.rn > 1
        `);
            yield queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_shifts_one_open_per_branch"
            ON "shifts" ("branch_id")
            WHERE "status" = 'OPEN'
        `);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`DROP INDEX IF EXISTS "UQ_shifts_one_open_per_branch"`);
            yield queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN IF EXISTS "closed_by_user_id"`);
            yield queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN IF EXISTS "opened_by_user_id"`);
        });
    }
}
exports.BranchSharedShift1770800000000 = BranchSharedShift1770800000000;
