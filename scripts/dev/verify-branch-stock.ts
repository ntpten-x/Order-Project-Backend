import { AppDataSource } from "../../src/database/database";
import { Branch } from "../../src/entity/Branch";
import { Roles } from "../../src/entity/Roles";
import { Users } from "../../src/entity/Users";
import { Ingredients } from "../../src/entity/stock/Ingredients";
import { IngredientsUnit } from "../../src/entity/stock/IngredientsUnit";
import { StockOrdersModel } from "../../src/models/stock/orders.model";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

function assert(condition: any, message: string) {
    if (!condition) throw new Error(message);
}

function logOk(msg: string) {
    process.stdout.write(`[OK] ${msg}\n`);
}

function logInfo(msg: string) {
    process.stdout.write(`[INFO] ${msg}\n`);
}

async function ensureDb() {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
}

function ensureLocalDb() {
    const host = (process.env.DATABASE_HOST || "").trim();
    if (!host) return;
    const allowed = new Set(["localhost", "127.0.0.1", "::1", "db"]);
    if (!allowed.has(host)) {
        throw new Error(
            `Refusing to run verify-branch-stock on non-local DATABASE_HOST=${host}. Set DATABASE_HOST=localhost or run in an isolated DB.`
        );
    }
}

async function main() {
    ensureLocalDb();
    await ensureDb();

    const branchRepo = AppDataSource.getRepository(Branch);
    const userRepo = AppDataSource.getRepository(Users);
    const roleRepo = AppDataSource.getRepository(Roles);
    const unitRepo = AppDataSource.getRepository(IngredientsUnit);
    const ingredientRepo = AppDataSource.getRepository(Ingredients);

    const branch =
        (await branchRepo
            .createQueryBuilder("b")
            .orderBy("b.create_date", "DESC")
            .getOne()) ?? null;
    assert(branch?.id, "No branch found in DB. Seed branches first.");
    const branchEntity = branch!;
    const branchId = branchEntity.id;
    logInfo(`Using branch: ${branchEntity.branch_name ?? branchId} (${branchId})`);

    let user =
        (await userRepo
            .createQueryBuilder("u")
            .where("u.branch_id = :branchId", { branchId })
            .orderBy("u.create_date", "DESC")
            .getOne()) ?? null;

    if (!user) {
        const adminRole =
            (await roleRepo
                .createQueryBuilder("r")
                .where("r.roles_name = :name", { name: "Admin" })
                .getOne()) ?? null;
        assert(adminRole?.id, "Admin role not found. Ensure roles are seeded.");
        const adminRoleId = adminRole!.id;

        const suffix = randomUUID().slice(0, 8);
        user = await userRepo.save(
            userRepo.create({
                username: `stock_verify_${suffix}`,
                name: `Stock Verify ${suffix}`,
                password: await bcrypt.hash(`Stock${suffix}!`, 10),
                roles_id: adminRoleId,
                is_use: true,
                is_active: false,
                branch_id: branchId,
            })
        );
        logInfo(`Created user: ${user.username} (${user.id})`);
    } else {
        logInfo(`Using user: ${user.username} (${user.id})`);
    }

    // Ensure unit exists in this branch
    const unitName = `e2e_unit_${randomUUID().slice(0, 8)}`;
    const unit = await unitRepo.save(
        unitRepo.create({
            unit_name: unitName,
            display_name: `Unit ${unitName}`,
            is_active: true,
            branch_id: branchId,
        })
    );
    logOk(`Created ingredients unit: ${unit.display_name} (${unit.id})`);

    // Ensure ingredient exists in this branch
    const ingredientName = `e2e_ing_${randomUUID().slice(0, 8)}`;
    const ingredientEntity = ingredientRepo.create({
            ingredient_name: ingredientName,
            display_name: `Ingredient ${ingredientName}`,
            description: "verify branch_stock update after confirmPurchase",
            img_url: null,
            is_active: true,
            unit_id: unit.id,
            branch_id: branchId,
        } as any) as unknown as Ingredients;
    const ingredient = await ingredientRepo.save(ingredientEntity);
    logOk(`Created ingredient: ${ingredient.display_name} (${ingredient.id})`);

    const ordersModel = new StockOrdersModel();
    const order = await ordersModel.createOrderWithItems(
        user.id,
        [{ ingredient_id: ingredient.id, quantity_ordered: 5 }],
        "verify branch_stock",
        branchId
    );
    logOk(`Created order: ${order.id}`);

    await ordersModel.confirmPurchase(
        order.id,
        [{ ingredient_id: ingredient.id, actual_quantity: 5, is_purchased: true }],
        user.id,
        branchId
    );
    logOk(`Confirmed purchase for order: ${order.id}`);

    const rows: Array<{ quantity: string | number }> = await AppDataSource.manager.query(
        `SELECT quantity FROM branch_stock WHERE branch_id = $1 AND ingredient_id = $2`,
        [branchId, ingredient.id]
    );
    assert(rows.length === 1, "Expected branch_stock row to be created after confirmPurchase.");
    const qty = Number(rows[0]?.quantity ?? 0);
    assert(qty === 5, `Expected branch_stock.quantity=5, got ${qty}`);
    logOk("branch_stock updated correctly (quantity incremented).");
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[FAIL]", err);
    process.exitCode = 1;
});
