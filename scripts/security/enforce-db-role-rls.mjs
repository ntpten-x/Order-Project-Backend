import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, "\"\"")}"`;
}

async function main() {
  const shouldFix = process.argv.includes("--fix") || process.env.FIX_BYPASSRLS === "1";
  const allowSuperuser = process.env.ALLOW_SUPERUSER_DB_ROLE === "1";
  const useSsl = process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "1";

  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ...(useSsl
      ? { ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true" } }
      : {}),
  });

  await client.connect();
  try {
    const roleRows = await client.query(
      `
        SELECT r.rolname, r.rolsuper, r.rolbypassrls
        FROM pg_roles r
        WHERE r.rolname = current_user
      `
    );

    if (!roleRows.rows[0]) {
      throw new Error("Unable to resolve current DB role");
    }

    const role = roleRows.rows[0];
    const roleName = role.rolname;
    const isSuperuser = Boolean(role.rolsuper);
    const hasBypassRls = Boolean(role.rolbypassrls);

    console.log(
      `[db-role-rls] role=${roleName} superuser=${isSuperuser ? "true" : "false"} bypassrls=${hasBypassRls ? "true" : "false"}`
    );

    if (isSuperuser && !allowSuperuser) {
      console.error(
        "[db-role-rls] FAIL current DB role is superuser; use a dedicated non-superuser app role for real RLS isolation."
      );
      process.exitCode = 1;
      return;
    }

    if (!hasBypassRls) {
      console.log("[db-role-rls] PASS role does not have BYPASSRLS.");
      return;
    }

    if (!shouldFix) {
      console.error(
        "[db-role-rls] FAIL role has BYPASSRLS. Re-run with --fix or set FIX_BYPASSRLS=1 to apply ALTER ROLE ... NOBYPASSRLS."
      );
      process.exitCode = 1;
      return;
    }

    if (isSuperuser) {
      console.error(
        "[db-role-rls] FAIL cannot harden superuser role automatically. Create/use a non-superuser application role."
      );
      process.exitCode = 1;
      return;
    }

    await client.query(`ALTER ROLE ${quoteIdent(roleName)} NOBYPASSRLS`);
    console.log(`[db-role-rls] FIXED applied ALTER ROLE ${roleName} NOBYPASSRLS`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[db-role-rls] failed: ${error.message}`);
  process.exit(1);
});
