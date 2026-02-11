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
exports.AddReadHeavyQueryIndexes1771200000000 = void 0;
class AddReadHeavyQueryIndexes1771200000000 {
    constructor() {
        this.name = "AddReadHeavyQueryIndexes1771200000000";
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            // Hot paths: /pos/orders/summary (branch + status/type + latest first)
            yield queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_orders_branch_created_at_desc
            ON "sales_orders" ("branch_id", "create_date" DESC)
        `);
            yield queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_orders_branch_status_type_created_at_desc
            ON "sales_orders" ("branch_id", "status", "order_type", "create_date" DESC)
        `);
            yield queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_orders_branch_status_created_at_desc
            ON "sales_orders" ("branch_id", "status", "create_date" DESC)
        `);
            // Hot paths: summary lateral aggregate per order on sales_order_item
            yield queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_order_item_order_status
            ON "sales_order_item" ("order_id", "status")
        `);
            // Hot paths: dashboard sales/top-items joins on successful payments by order
            yield queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_payments_order_status
            ON "payments" ("order_id", "status")
        `);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_payments_order_status"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sales_order_item_order_status"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sales_orders_branch_status_created_at_desc"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sales_orders_branch_status_type_created_at_desc"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sales_orders_branch_created_at_desc"`);
        });
    }
}
exports.AddReadHeavyQueryIndexes1771200000000 = AddReadHeavyQueryIndexes1771200000000;
