const { Client } = require("pg");
const bcrypt = require("bcrypt");
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

async function main() {
  const username = process.env.E2E_USERNAME || "e2e_pos_admin";
  const password = process.env.E2E_PASSWORD || "E2E_Pos_123!";
  const roleName = process.env.E2E_ROLE || "Admin";
  const displayName = process.env.E2E_DISPLAY_NAME || username;
  const resetUserOverrides = process.env.E2E_RESET_USER_OVERRIDES === "true";
  const host = process.env.DATABASE_HOST;
  const port = Number(process.env.DATABASE_PORT || 5432);
  const database = process.env.DATABASE_NAME;
  const sslEnabled = process.env.DATABASE_SSL === "true";

  console.log(
    `[e2e-user] connect target host=${host || "(empty)"} port=${port} db=${database || "(empty)"} ssl=${sslEnabled}`
  );

  const client = new Client({
    host,
    port,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database,
    ssl:
      sslEnabled
        ? {
            rejectUnauthorized:
              process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
          }
        : false,
  });

  await client.connect();

  try {
    const roleRes = await client.query(
      `SELECT id, roles_name FROM roles WHERE lower(roles_name) = lower($1) LIMIT 1`,
      [roleName]
    );
    if (roleRes.rowCount === 0) {
      throw new Error(`Role not found: ${roleName}`);
    }
    const roleId = roleRes.rows[0].id;
    const resolvedRoleName = roleRes.rows[0].roles_name;

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

    let userId = existingRes.rows?.[0]?.id || null;

    if (existingRes.rowCount === 0) {
      const insertRes = await client.query(
        `INSERT INTO users (username, name, password, roles_id, branch_id, is_use, is_active)
         VALUES ($1, $2, $3, $4, $5, true, false)`,
        [username, displayName, passwordHash, roleId, branchId]
      );
      userId = insertRes.rows?.[0]?.id || null;
      console.log(`[e2e-user] created ${username}`);
    } else {
      await client.query(
        `UPDATE users
         SET name = $1, password = $2, roles_id = $3, branch_id = $4, is_use = true
         WHERE username = $5`,
        [displayName, passwordHash, roleId, branchId, username]
      );
      console.log(`[e2e-user] updated ${username}`);
    }

    if (!userId) {
      const userRes = await client.query(
        `SELECT id FROM users WHERE username = $1 LIMIT 1`,
        [username]
      );
      userId = userRes.rows?.[0]?.id || null;
    }

    if (resetUserOverrides && userId) {
      await client.query(`DELETE FROM user_permissions WHERE user_id = $1`, [userId]);
      console.log(`[e2e-user] reset user overrides for ${username}`);
    }

    console.log(`[e2e-user] username=${username}`);
    console.log(`[e2e-user] role=${resolvedRoleName}`);
    console.log("[e2e-user] password is set from E2E_PASSWORD or default");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[e2e-user] failed:", formatConnectError(error));
  process.exit(1);
});
