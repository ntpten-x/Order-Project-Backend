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
exports.EnforceUsersBranchId1770600000000 = void 0;
class EnforceUsersBranchId1770600000000 {
    constructor() {
        this.name = "EnforceUsersBranchId1770600000000";
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            // Performance: common filters in admin user management and reporting
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_branch_id" ON "users" ("branch_id")`);
            // Backfill legacy NULL branch_id rows (to avoid "invisible" users after branch scoping).
            const nullRows = yield queryRunner.query(`SELECT COUNT(*)::int AS count FROM "users" WHERE "branch_id" IS NULL`);
            const nullCount = Number((_b = (_a = nullRows === null || nullRows === void 0 ? void 0 : nullRows[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0);
            if (nullCount > 0) {
                const countRows = yield queryRunner.query(`SELECT COUNT(*)::int AS count FROM "branches"`);
                const branchCount = Number((_d = (_c = countRows === null || countRows === void 0 ? void 0 : countRows[0]) === null || _c === void 0 ? void 0 : _c.count) !== null && _d !== void 0 ? _d : 0);
                const envBackfillBranchId = (process.env.BRANCH_BACKFILL_ID || process.env.DEFAULT_BRANCH_ID || "").trim();
                let backfillBranchId = envBackfillBranchId || "";
                if (!backfillBranchId) {
                    if (branchCount === 0) {
                        throw new Error('Migration requires at least one row in "branches". Create a branch first, then rerun migrations.');
                    }
                    if (branchCount > 1) {
                        throw new Error('Multiple branches exist; set env BRANCH_BACKFILL_ID (uuid) to backfill NULL users.branch_id safely.');
                    }
                    const idRows = yield queryRunner.query(`SELECT id FROM "branches" LIMIT 1`);
                    backfillBranchId = String((_f = (_e = idRows === null || idRows === void 0 ? void 0 : idRows[0]) === null || _e === void 0 ? void 0 : _e.id) !== null && _f !== void 0 ? _f : "").trim();
                }
                if (!backfillBranchId) {
                    throw new Error("Failed to resolve a backfill branch id (BRANCH_BACKFILL_ID/DEFAULT_BRANCH_ID).");
                }
                yield queryRunner.query(`UPDATE "users" SET "branch_id" = $1 WHERE "branch_id" IS NULL`, [
                    backfillBranchId,
                ]);
            }
            yield queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "branch_id" SET NOT NULL`);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "branch_id" DROP NOT NULL`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_branch_id"`);
        });
    }
}
exports.EnforceUsersBranchId1770600000000 = EnforceUsersBranchId1770600000000;
