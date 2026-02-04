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
exports.AddProductsPriceDelivery1770700000000 = void 0;
class AddProductsPriceDelivery1770700000000 {
    constructor() {
        this.name = "AddProductsPriceDelivery1770700000000";
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "price_delivery" numeric(12,2)`);
            // Backfill legacy rows (default delivery price = store price)
            yield queryRunner.query(`UPDATE "products" SET "price_delivery" = "price" WHERE "price_delivery" IS NULL`);
            yield queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "price_delivery" SET DEFAULT 0`);
            yield queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "price_delivery" SET NOT NULL`);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "price_delivery"`);
        });
    }
}
exports.AddProductsPriceDelivery1770700000000 = AddProductsPriceDelivery1770700000000;
