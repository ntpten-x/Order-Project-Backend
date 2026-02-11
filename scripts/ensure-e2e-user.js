const { Client } = require("pg");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");

dotenv.config();

async function main() {
  const username = process.env.E2E_USERNAME || "e2e_pos_admin";
  const password = process.env.E2E_PASSWORD || "E2E_Pos_123!";

  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 5432),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized:
              process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
          }
        : false,
  });

  await client.connect();

  try {
    const roleRes = await client.query(
      `SELECT id FROM roles WHERE roles_name = 'Admin' LIMIT 1`
    );
    if (roleRes.rowCount === 0) {
      throw new Error("Admin role not found");
    }
    const roleId = roleRes.rows[0].id;

    const branchRes = await client.query(
      `SELECT id FROM branches WHERE is_active = true ORDER BY create_date ASC LIMIT 1`
    );
    if (branchRes.rowCount === 0) {
      throw new Error("No active branch found");
    }
    const branchId = branchRes.rows[0].id;

    const passwordHash = await bcrypt.hash(password, 10);

    const existingRes = await client.query(
      `SELECT id FROM users WHERE username = $1 LIMIT 1`,
      [username]
    );

    if (existingRes.rowCount === 0) {
      await client.query(
        `INSERT INTO users (username, name, password, roles_id, branch_id, is_use, is_active)
         VALUES ($1, $2, $3, $4, $5, true, false)`,
        [username, "E2E POS Admin", passwordHash, roleId, branchId]
      );
      console.log(`[e2e-user] created ${username}`);
    } else {
      await client.query(
        `UPDATE users
         SET password = $1, roles_id = $2, branch_id = $3, is_use = true
         WHERE username = $4`,
        [passwordHash, roleId, branchId, username]
      );
      console.log(`[e2e-user] updated ${username}`);
    }

    console.log(`[e2e-user] username=${username}`);
    console.log("[e2e-user] password is set from E2E_PASSWORD or default");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[e2e-user] failed:", error.message);
  process.exit(1);
});
