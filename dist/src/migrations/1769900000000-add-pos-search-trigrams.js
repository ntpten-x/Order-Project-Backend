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
exports.AddPosSearchTrigrams1769900000000 = void 0;
class AddPosSearchTrigrams1769900000000 {
    constructor() {
        this.name = "AddPosSearchTrigrams1769900000000";
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
            yield queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tables_table_name_trgm
            ON "tables" USING gin (table_name gin_trgm_ops)
        `);
            yield queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_delivery_delivery_name_trgm
            ON "delivery" USING gin (delivery_name gin_trgm_ops)
        `);
            yield queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_payment_method_name_trgm
            ON "payment_method" USING gin (payment_method_name gin_trgm_ops)
        `);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`DROP INDEX IF EXISTS idx_payment_method_name_trgm`);
            yield queryRunner.query(`DROP INDEX IF EXISTS idx_delivery_delivery_name_trgm`);
            yield queryRunner.query(`DROP INDEX IF EXISTS idx_tables_table_name_trgm`);
        });
    }
}
exports.AddPosSearchTrigrams1769900000000 = AddPosSearchTrigrams1769900000000;
