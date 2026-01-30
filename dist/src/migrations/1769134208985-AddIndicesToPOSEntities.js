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
exports.AddIndicesToPOSEntities1769134208985 = void 0;
class AddIndicesToPOSEntities1769134208985 {
    constructor() {
        this.name = 'AddIndicesToPOSEntities1769134208985';
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_sales_order_item_order_id"`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_21278276a20cd242a6ba10efc0" ON "tables" ("status") `);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_894a8151f2433fca9b81acb297" ON "products" ("product_name") `);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_4759a2cc727c8989652f479c64" ON "sales_order_item" ("order_id") `);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dc1e84f1d1e75e990952c40859" ON "shifts" ("user_id") `);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_3e044af0f8d48f964102ee2bf6" ON "shifts" ("status") `);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b2f7b823a21562eeca20e72b00" ON "payments" ("order_id") `);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b9629005079d9c0ca515deb795" ON "payments" ("shift_id") `);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_308797ee916b40fc1cc4fc46cf" ON "sales_orders" ("table_id") `);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_308797ee916b40fc1cc4fc46cf"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_b9629005079d9c0ca515deb795"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_b2f7b823a21562eeca20e72b00"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_3e044af0f8d48f964102ee2bf6"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_dc1e84f1d1e75e990952c40859"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_4759a2cc727c8989652f479c64"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_894a8151f2433fca9b81acb297"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_21278276a20cd242a6ba10efc0"`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_order_item_order_id" ON "sales_order_item" ("order_id") `);
        });
    }
}
exports.AddIndicesToPOSEntities1769134208985 = AddIndicesToPOSEntities1769134208985;
