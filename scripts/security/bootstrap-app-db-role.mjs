import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, "\"\"")}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const roleName = readArg("--role") || process.env.APP_DATABASE_USER || process.env.DATABASE_APP_USER;
  const rolePassword =
    readArg("--password") || process.env.APP_DATABASE_PASSWORD || process.env.DATABASE_APP_PASSWORD;
  const schemaName = readArg("--schema") || process.env.DATABASE_SCHEMA || "public";
  const databaseName = process.env.DATABASE_NAME;
  const useSsl = process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "1";

  if (!roleName || !rolePassword) {
    throw new Error(
      "Missing app DB role credentials. Provide --role/--password or APP_DATABASE_USER/APP_DATABASE_PASSWORD."
    );
  }
  if (!databaseName) {
    throw new Error("DATABASE_NAME is required");
  }

  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: databaseName,
    ...(useSsl
      ? { ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true" } }
      : {}),
  });

  await client.connect();
  try {
    const roleResult = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = $1 LIMIT 1`, [roleName]);
    if (roleResult.rowCount === 0) {
      await client.query(
        `CREATE ROLE ${quoteIdent(
          roleName
        )} LOGIN PASSWORD ${quoteLiteral(
          rolePassword
        )} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`
      );
      console.log(`[db-role-bootstrap] created role=${roleName}`);
    } else {
      await client.query(
        `ALTER ROLE ${quoteIdent(
          roleName
        )} WITH LOGIN PASSWORD ${quoteLiteral(
          rolePassword
        )} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`
      );
      console.log(`[db-role-bootstrap] updated role=${roleName}`);
    }

    await client.query(`GRANT CONNECT ON DATABASE ${quoteIdent(databaseName)} TO ${quoteIdent(roleName)}`);
    await client.query(`GRANT USAGE ON SCHEMA ${quoteIdent(schemaName)} TO ${quoteIdent(roleName)}`);
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${quoteIdent(schemaName)} TO ${quoteIdent(roleName)}`
    );
    await client.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${quoteIdent(schemaName)} TO ${quoteIdent(roleName)}`
    );
    await client.query(
      `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${quoteIdent(schemaName)} TO ${quoteIdent(roleName)}`
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${quoteIdent(
        schemaName
      )} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quoteIdent(roleName)}`
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${quoteIdent(
        schemaName
      )} GRANT USAGE, SELECT ON SEQUENCES TO ${quoteIdent(roleName)}`
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${quoteIdent(schemaName)} GRANT EXECUTE ON FUNCTIONS TO ${quoteIdent(roleName)}`
    );

    console.log(`[db-role-bootstrap] grants applied schema=${schemaName} database=${databaseName}`);
    console.log(
      `[db-role-bootstrap] next: set DATABASE_USER=${roleName} and DATABASE_PASSWORD=<your-password>, then run npm run security:db-role:check`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[db-role-bootstrap] failed: ${error.message}`);
  process.exit(1);
});
