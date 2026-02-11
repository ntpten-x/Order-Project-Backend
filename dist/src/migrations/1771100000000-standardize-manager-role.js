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
exports.StandardizeManagerRole1771100000000 = void 0;
class StandardizeManagerRole1771100000000 {
    constructor() {
        this.name = "StandardizeManagerRole1771100000000";
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const roleRows = (yield queryRunner.query(`
            SELECT id, roles_name
            FROM roles
            WHERE lower(roles_name) IN ('manager', 'maneger')
            ORDER BY CASE WHEN roles_name = 'Manager' THEN 0 ELSE 1 END, create_date ASC
            `));
            if (!roleRows.length)
                return;
            let canonical = (_a = roleRows.find((row) => row.roles_name === "Manager")) !== null && _a !== void 0 ? _a : roleRows[0];
            if (canonical.roles_name !== "Manager") {
                yield queryRunner.query(`
                UPDATE roles
                SET roles_name = 'Manager'
                WHERE id = $1
                `, [canonical.id]);
                canonical = Object.assign(Object.assign({}, canonical), { roles_name: "Manager" });
            }
            const duplicateIds = roleRows
                .filter((row) => row.id !== canonical.id)
                .map((row) => row.id);
            if (!duplicateIds.length)
                return;
            yield queryRunner.query(`
            UPDATE users
            SET roles_id = $1
            WHERE roles_id = ANY($2::uuid[])
            `, [canonical.id, duplicateIds]);
            yield queryRunner.query(`
            DELETE FROM roles
            WHERE id = ANY($1::uuid[])
            `, [duplicateIds]);
        });
    }
    down(_queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            // Irreversible data standardization.
        });
    }
}
exports.StandardizeManagerRole1771100000000 = StandardizeManagerRole1771100000000;
