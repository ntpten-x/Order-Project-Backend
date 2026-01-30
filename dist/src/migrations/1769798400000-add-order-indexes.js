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
exports.AddOrderIndexes1769798400000 = void 0;
class AddOrderIndexes1769798400000 {
    constructor() {
        this.name = 'AddOrderIndexes1769798400000';
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_orders_order_type" ON "sales_orders" ("order_type")`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_orders_delivery_id" ON "sales_orders" ("delivery_id")`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_order_item_status" ON "sales_order_item" ("status")`);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_sales_order_item_status"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_sales_orders_delivery_id"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_sales_orders_order_type"`);
        });
    }
}
exports.AddOrderIndexes1769798400000 = AddOrderIndexes1769798400000;
