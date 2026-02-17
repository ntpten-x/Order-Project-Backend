const { Client } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

function formatConnectError(error) {
  if (!error) return "Unknown error";
  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors
      .map((item) => `${item.code || "ERR"} ${item.address || "?"}:${item.port || "?"}`)
      .join(", ");
  }
  const parts = [];
  if (error.code) parts.push(`code=${error.code}`);
  if (error.address) parts.push(`address=${error.address}`);
  if (error.port) parts.push(`port=${error.port}`);
  if (error.message) parts.push(`message=${error.message}`);
  return parts.join(" ");
}

async function ensureBranch(client) {
  const envBranchId = (process.env.E2E_BRANCH_ID || process.env.DEFAULT_BRANCH_ID || "").trim();
  if (envBranchId) {
    const existing = await client.query(`SELECT id FROM branches WHERE id = $1 LIMIT 1`, [envBranchId]);
    if (existing.rows[0]?.id) return existing.rows[0].id;
  }

  const active = await client.query(
    `SELECT id FROM branches WHERE is_active = true ORDER BY create_date ASC LIMIT 1`
  );
  if (active.rows[0]?.id) return active.rows[0].id;

  const created = await client.query(
    `
      INSERT INTO branches (branch_name, branch_code, is_active)
      VALUES ('E2E Main Branch', 'E2E', true)
      ON CONFLICT (branch_code)
      DO UPDATE SET
        branch_name = EXCLUDED.branch_name,
        is_active = true
      RETURNING id
    `
  );
  return created.rows[0].id;
}

async function ensureProductsUnit(client, branchId) {
  const result = await client.query(
    `
      INSERT INTO products_unit (unit_name, display_name, branch_id, is_active)
      VALUES ('piece', 'Piece', $1, true)
      ON CONFLICT (unit_name, branch_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        is_active = true
      RETURNING id
    `,
    [branchId]
  );
  return result.rows[0].id;
}

async function ensureCategory(client, branchId) {
  const result = await client.query(
    `
      INSERT INTO category (category_name, display_name, branch_id, is_active)
      VALUES ('e2e_general', 'E2E General', $1, true)
      ON CONFLICT (category_name, branch_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        is_active = true
      RETURNING id
    `,
    [branchId]
  );
  return result.rows[0].id;
}

async function ensureProduct(client, branchId, categoryId, unitId) {
  const existing = await client.query(
    `
      SELECT id
      FROM products
      WHERE branch_id = $1
        AND is_active = true
      ORDER BY create_date ASC
      LIMIT 1
    `,
    [branchId]
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  const inserted = await client.query(
    `
      INSERT INTO products (
        branch_id,
        product_name,
        display_name,
        description,
        price,
        cost,
        price_delivery,
        category_id,
        unit_id,
        is_active
      )
      VALUES ($1, 'e2e_product_baseline', 'E2E Product Baseline', 'Seeded for e2e', 99, 40, 109, $2, $3, true)
      RETURNING id
    `,
    [branchId, categoryId, unitId]
  );
  return inserted.rows[0].id;
}

async function ensurePaymentMethod(client, branchId) {
  const result = await client.query(
    `
      INSERT INTO payment_method (payment_method_name, display_name, branch_id, is_active)
      VALUES ('cash', 'Cash', $1, true)
      ON CONFLICT (payment_method_name, branch_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        is_active = true
      RETURNING id
    `,
    [branchId]
  );
  return result.rows[0].id;
}

async function ensureIngredientsUnit(client, branchId) {
  const result = await client.query(
    `
      INSERT INTO stock_ingredients_unit (unit_name, display_name, branch_id, is_active)
      VALUES ('pcs', 'PCS', $1, true)
      ON CONFLICT (unit_name, branch_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        is_active = true
      RETURNING id
    `,
    [branchId]
  );
  return result.rows[0].id;
}

async function ensureIngredients(client, branchId, unitId) {
  const seeds = [
    { key: "e2e_ing_a", name: "E2E Ingredient A" },
    { key: "e2e_ing_b", name: "E2E Ingredient B" },
  ];

  for (const seed of seeds) {
    await client.query(
      `
        INSERT INTO stock_ingredients (
          ingredient_name,
          display_name,
          branch_id,
          description,
          is_active,
          unit_id
        )
        VALUES ($1, $2, $3, 'Seeded for e2e', true, $4)
        ON CONFLICT (ingredient_name, branch_id)
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          unit_id = EXCLUDED.unit_id,
          is_active = true
      `,
      [seed.key, seed.name, branchId, unitId]
    );
  }
}

async function main() {
  const host = process.env.DATABASE_HOST;
  const port = Number(process.env.DATABASE_PORT || 5432);
  const database = process.env.DATABASE_NAME;
  const sslEnabled = process.env.DATABASE_SSL === "true";

  console.log(
    `[e2e-domain-baseline] connect target host=${host || "(empty)"} port=${port} db=${database || "(empty)"} ssl=${sslEnabled}`
  );

  const client = new Client({
    host,
    port,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database,
    ssl: sslEnabled
      ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true" }
      : false,
  });

  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.is_admin', 'true', false)`);
    await client.query(`SELECT set_config('app.branch_id', '', false)`);
    await client.query(`SELECT set_config('app.user_id', '', false)`);

    const branchId = await ensureBranch(client);
    const productsUnitId = await ensureProductsUnit(client, branchId);
    const categoryId = await ensureCategory(client, branchId);
    const productId = await ensureProduct(client, branchId, categoryId, productsUnitId);
    const paymentMethodId = await ensurePaymentMethod(client, branchId);
    const ingredientsUnitId = await ensureIngredientsUnit(client, branchId);
    await ensureIngredients(client, branchId, ingredientsUnitId);

    await client.query("COMMIT");
    console.log(
      `[e2e-domain-baseline] ensured branch=${branchId} product=${productId} paymentMethod=${paymentMethodId} ingredientsUnit=${ingredientsUnitId}`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[e2e-domain-baseline] failed:", formatConnectError(error));
  process.exit(1);
});
