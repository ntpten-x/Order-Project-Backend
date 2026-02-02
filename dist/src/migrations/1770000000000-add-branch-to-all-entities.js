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
exports.AddBranchToAllEntities1770000000000 = void 0;
class AddBranchToAllEntities1770000000000 {
    constructor() {
        this.name = 'AddBranchToAllEntities1770000000000';
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            // Add branch_id to Category
            yield queryRunner.query(`ALTER TABLE "category" ADD COLUMN IF NOT EXISTS "branch_id" uuid`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_category_branch_id" ON "category" ("branch_id")`);
            yield queryRunner.query(`ALTER TABLE "category" ADD CONSTRAINT "FK_category_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL`);
            // Drop unique constraints and recreate with branch_id
            yield queryRunner.query(`ALTER TABLE "category" DROP CONSTRAINT IF EXISTS "UQ_category_name"`);
            yield queryRunner.query(`ALTER TABLE "category" DROP CONSTRAINT IF EXISTS "category_category_name_key"`);
            yield queryRunner.query(`ALTER TABLE "category" DROP CONSTRAINT IF EXISTS "category_display_name_key"`);
            yield queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_category_name_branch" ON "category" ("category_name", "branch_id") WHERE "branch_id" IS NOT NULL`);
            yield queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_category_display_name_branch" ON "category" ("display_name", "branch_id") WHERE "branch_id" IS NOT NULL`);
            // Add branch_id to Products
            yield queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "branch_id" uuid`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_branch_id" ON "products" ("branch_id")`);
            yield queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "FK_products_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL`);
            // Add branch_id to ProductsUnit
            yield queryRunner.query(`ALTER TABLE "products_unit" ADD COLUMN IF NOT EXISTS "branch_id" uuid`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_unit_branch_id" ON "products_unit" ("branch_id")`);
            yield queryRunner.query(`ALTER TABLE "products_unit" ADD CONSTRAINT "FK_products_unit_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL`);
            // Drop unique constraints and recreate with branch_id
            yield queryRunner.query(`ALTER TABLE "products_unit" DROP CONSTRAINT IF EXISTS "products_unit_unit_name_key"`);
            yield queryRunner.query(`ALTER TABLE "products_unit" DROP CONSTRAINT IF EXISTS "products_unit_display_name_key"`);
            yield queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_products_unit_name_branch" ON "products_unit" ("unit_name", "branch_id") WHERE "branch_id" IS NOT NULL`);
            yield queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_products_unit_display_name_branch" ON "products_unit" ("display_name", "branch_id") WHERE "branch_id" IS NOT NULL`);
            // Add branch_id to Discounts
            yield queryRunner.query(`ALTER TABLE "discounts" ADD COLUMN IF NOT EXISTS "branch_id" uuid`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_discounts_branch_id" ON "discounts" ("branch_id")`);
            yield queryRunner.query(`ALTER TABLE "discounts" ADD CONSTRAINT "FK_discounts_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL`);
            // Drop unique constraints and recreate with branch_id
            yield queryRunner.query(`ALTER TABLE "discounts" DROP CONSTRAINT IF EXISTS "discounts_discount_name_key"`);
            yield queryRunner.query(`ALTER TABLE "discounts" DROP CONSTRAINT IF EXISTS "discounts_display_name_key"`);
            yield queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_discounts_name_branch" ON "discounts" ("discount_name", "branch_id") WHERE "branch_id" IS NOT NULL`);
            yield queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_discounts_display_name_branch" ON "discounts" ("display_name", "branch_id") WHERE "branch_id" IS NOT NULL`);
            // Add branch_id to Delivery
            yield queryRunner.query(`ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "branch_id" uuid`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_delivery_branch_id" ON "delivery" ("branch_id")`);
            yield queryRunner.query(`ALTER TABLE "delivery" ADD CONSTRAINT "FK_delivery_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL`);
            // Add branch_id to PaymentMethod
            yield queryRunner.query(`ALTER TABLE "payment_method" ADD COLUMN IF NOT EXISTS "branch_id" uuid`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payment_method_branch_id" ON "payment_method" ("branch_id")`);
            yield queryRunner.query(`ALTER TABLE "payment_method" ADD CONSTRAINT "FK_payment_method_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL`);
            // Drop unique constraints and recreate with branch_id
            yield queryRunner.query(`ALTER TABLE "payment_method" DROP CONSTRAINT IF EXISTS "payment_method_payment_method_name_key"`);
            yield queryRunner.query(`ALTER TABLE "payment_method" DROP CONSTRAINT IF EXISTS "payment_method_display_name_key"`);
            yield queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_method_name_branch" ON "payment_method" ("payment_method_name", "branch_id") WHERE "branch_id" IS NOT NULL`);
            yield queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_method_display_name_branch" ON "payment_method" ("display_name", "branch_id") WHERE "branch_id" IS NOT NULL`);
            // Add branch_id to Ingredients
            yield queryRunner.query(`ALTER TABLE "stock_ingredients" ADD COLUMN IF NOT EXISTS "branch_id" uuid`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_stock_ingredients_branch_id" ON "stock_ingredients" ("branch_id")`);
            yield queryRunner.query(`ALTER TABLE "stock_ingredients" ADD CONSTRAINT "FK_stock_ingredients_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL`);
            // Drop unique constraints and recreate with branch_id
            yield queryRunner.query(`ALTER TABLE "stock_ingredients" DROP CONSTRAINT IF EXISTS "stock_ingredients_ingredient_name_key"`);
            yield queryRunner.query(`ALTER TABLE "stock_ingredients" DROP CONSTRAINT IF EXISTS "stock_ingredients_display_name_key"`);
            yield queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_ingredients_name_branch" ON "stock_ingredients" ("ingredient_name", "branch_id") WHERE "branch_id" IS NOT NULL`);
            yield queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_ingredients_display_name_branch" ON "stock_ingredients" ("display_name", "branch_id") WHERE "branch_id" IS NOT NULL`);
            // Add branch_id to IngredientsUnit
            yield queryRunner.query(`ALTER TABLE "stock_ingredients_unit" ADD COLUMN IF NOT EXISTS "branch_id" uuid`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_stock_ingredients_unit_branch_id" ON "stock_ingredients_unit" ("branch_id")`);
            yield queryRunner.query(`ALTER TABLE "stock_ingredients_unit" ADD CONSTRAINT "FK_stock_ingredients_unit_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL`);
            // Drop unique constraints and recreate with branch_id
            yield queryRunner.query(`ALTER TABLE "stock_ingredients_unit" DROP CONSTRAINT IF EXISTS "stock_ingredients_unit_unit_name_key"`);
            yield queryRunner.query(`ALTER TABLE "stock_ingredients_unit" DROP CONSTRAINT IF EXISTS "stock_ingredients_unit_display_name_key"`);
            yield queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_ingredients_unit_name_branch" ON "stock_ingredients_unit" ("unit_name", "branch_id") WHERE "branch_id" IS NOT NULL`);
            yield queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_ingredients_unit_display_name_branch" ON "stock_ingredients_unit" ("display_name", "branch_id") WHERE "branch_id" IS NOT NULL`);
            // Add branch_id to ShopProfile
            yield queryRunner.query(`ALTER TABLE "shop_profile" ADD COLUMN IF NOT EXISTS "branch_id" uuid`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_shop_profile_branch_id" ON "shop_profile" ("branch_id")`);
            yield queryRunner.query(`ALTER TABLE "shop_profile" ADD CONSTRAINT "FK_shop_profile_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL`);
            // Add branch_id to ShopPaymentAccount
            yield queryRunner.query(`ALTER TABLE "shop_payment_account" ADD COLUMN IF NOT EXISTS "branch_id" uuid`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_shop_payment_account_branch_id" ON "shop_payment_account" ("branch_id")`);
            yield queryRunner.query(`ALTER TABLE "shop_payment_account" ADD CONSTRAINT "FK_shop_payment_account_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL`);
            // Add branch_id to Payments (via order already has branch, but for direct query efficiency)
            yield queryRunner.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "branch_id" uuid`);
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_branch_id" ON "payments" ("branch_id")`);
            yield queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL`);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            // Remove branch_id from Payments
            yield queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "FK_payments_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_branch_id"`);
            yield queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "branch_id"`);
            // Remove branch_id from ShopPaymentAccount
            yield queryRunner.query(`ALTER TABLE "shop_payment_account" DROP CONSTRAINT IF EXISTS "FK_shop_payment_account_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "IDX_shop_payment_account_branch_id"`);
            yield queryRunner.query(`ALTER TABLE "shop_payment_account" DROP COLUMN IF EXISTS "branch_id"`);
            // Remove branch_id from ShopProfile
            yield queryRunner.query(`ALTER TABLE "shop_profile" DROP CONSTRAINT IF EXISTS "FK_shop_profile_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "IDX_shop_profile_branch_id"`);
            yield queryRunner.query(`ALTER TABLE "shop_profile" DROP COLUMN IF EXISTS "branch_id"`);
            // Remove branch_id from IngredientsUnit
            yield queryRunner.query(`DROP INDEX IF EXISTS "UQ_stock_ingredients_unit_name_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "UQ_stock_ingredients_unit_display_name_branch"`);
            yield queryRunner.query(`ALTER TABLE "stock_ingredients_unit" DROP CONSTRAINT IF EXISTS "FK_stock_ingredients_unit_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_ingredients_unit_branch_id"`);
            yield queryRunner.query(`ALTER TABLE "stock_ingredients_unit" DROP COLUMN IF EXISTS "branch_id"`);
            // Remove branch_id from Ingredients
            yield queryRunner.query(`DROP INDEX IF EXISTS "UQ_stock_ingredients_name_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "UQ_stock_ingredients_display_name_branch"`);
            yield queryRunner.query(`ALTER TABLE "stock_ingredients" DROP CONSTRAINT IF EXISTS "FK_stock_ingredients_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_ingredients_branch_id"`);
            yield queryRunner.query(`ALTER TABLE "stock_ingredients" DROP COLUMN IF EXISTS "branch_id"`);
            // Remove branch_id from PaymentMethod
            yield queryRunner.query(`DROP INDEX IF EXISTS "UQ_payment_method_name_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "UQ_payment_method_display_name_branch"`);
            yield queryRunner.query(`ALTER TABLE "payment_method" DROP CONSTRAINT IF EXISTS "FK_payment_method_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "IDX_payment_method_branch_id"`);
            yield queryRunner.query(`ALTER TABLE "payment_method" DROP COLUMN IF EXISTS "branch_id"`);
            // Remove branch_id from Delivery
            yield queryRunner.query(`ALTER TABLE "delivery" DROP CONSTRAINT IF EXISTS "FK_delivery_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "IDX_delivery_branch_id"`);
            yield queryRunner.query(`ALTER TABLE "delivery" DROP COLUMN IF EXISTS "branch_id"`);
            // Remove branch_id from Discounts
            yield queryRunner.query(`DROP INDEX IF EXISTS "UQ_discounts_name_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "UQ_discounts_display_name_branch"`);
            yield queryRunner.query(`ALTER TABLE "discounts" DROP CONSTRAINT IF EXISTS "FK_discounts_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "IDX_discounts_branch_id"`);
            yield queryRunner.query(`ALTER TABLE "discounts" DROP COLUMN IF EXISTS "branch_id"`);
            // Remove branch_id from ProductsUnit
            yield queryRunner.query(`DROP INDEX IF EXISTS "UQ_products_unit_name_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "UQ_products_unit_display_name_branch"`);
            yield queryRunner.query(`ALTER TABLE "products_unit" DROP CONSTRAINT IF EXISTS "FK_products_unit_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_unit_branch_id"`);
            yield queryRunner.query(`ALTER TABLE "products_unit" DROP COLUMN IF EXISTS "branch_id"`);
            // Remove branch_id from Products
            yield queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "FK_products_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_branch_id"`);
            yield queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "branch_id"`);
            // Remove branch_id from Category
            yield queryRunner.query(`DROP INDEX IF EXISTS "UQ_category_name_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "UQ_category_display_name_branch"`);
            yield queryRunner.query(`ALTER TABLE "category" DROP CONSTRAINT IF EXISTS "FK_category_branch"`);
            yield queryRunner.query(`DROP INDEX IF EXISTS "IDX_category_branch_id"`);
            yield queryRunner.query(`ALTER TABLE "category" DROP COLUMN IF EXISTS "branch_id"`);
        });
    }
}
exports.AddBranchToAllEntities1770000000000 = AddBranchToAllEntities1770000000000;
