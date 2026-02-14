const { Client } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

const ACTIONS = [
  { key: "access", name: "Access" },
  { key: "view", name: "View" },
  { key: "create", name: "Create" },
  { key: "update", name: "Update" },
  { key: "delete", name: "Delete" },
];

const RESOURCE_SEEDS = [
  {
    resourceKey: "permissions.page",
    resourceName: "Permissions Management",
    routePattern: "/users/permissions",
    sortOrder: 190,
    policies: {
      Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
      Manager: { scope: "branch", access: "deny", view: "deny", create: "deny", update: "deny", delete: "deny" },
      Employee: { scope: "branch", access: "deny", view: "deny", create: "deny", update: "deny", delete: "deny" },
    },
  },
  {
    resourceKey: "shifts.page",
    resourceName: "Shift Management",
    routePattern: "/pos/shift",
    sortOrder: 210,
    policies: {
      Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "deny" },
      Manager: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "deny" },
      Employee: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "deny" },
    },
  },
];

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

async function ensureActions(client) {
  for (const action of ACTIONS) {
    await client.query(
      `
        INSERT INTO permission_actions (action_key, action_name, is_active)
        VALUES ($1, $2, true)
        ON CONFLICT (action_key)
        DO UPDATE SET
          action_name = EXCLUDED.action_name,
          is_active = true
      `,
      [action.key, action.name]
    );
  }
}

async function ensureResources(client) {
  for (const resource of RESOURCE_SEEDS) {
    await client.query(
      `
        INSERT INTO permission_resources (
          resource_key,
          resource_name,
          route_pattern,
          resource_type,
          sort_order,
          is_active
        )
        VALUES ($1, $2, $3, 'page', $4, true)
        ON CONFLICT (resource_key)
        DO UPDATE SET
          resource_name = EXCLUDED.resource_name,
          route_pattern = EXCLUDED.route_pattern,
          resource_type = EXCLUDED.resource_type,
          sort_order = EXCLUDED.sort_order,
          is_active = true,
          updated_at = now()
      `,
      [resource.resourceKey, resource.resourceName, resource.routePattern, resource.sortOrder]
    );
  }
}

async function ensureRolePermissions(client) {
  for (const resource of RESOURCE_SEEDS) {
    for (const [roleName, policy] of Object.entries(resource.policies)) {
      for (const action of ACTIONS) {
        const effect = policy[action.key];
        const scope = effect === "allow" ? policy.scope : "none";
        await client.query(
          `
            WITH target AS (
              SELECT
                r.id AS role_id,
                pr.id AS resource_id,
                pa.id AS action_id
              FROM roles r
              INNER JOIN permission_resources pr ON pr.resource_key = $1
              INNER JOIN permission_actions pa ON pa.action_key = $2
              WHERE lower(r.roles_name) = lower($3)
              LIMIT 1
            ),
            deleted AS (
              DELETE FROM role_permissions rp
              USING target t
              WHERE rp.role_id = t.role_id
                AND rp.resource_id = t.resource_id
                AND rp.action_id = t.action_id
            )
            INSERT INTO role_permissions (role_id, resource_id, action_id, effect, scope)
            SELECT role_id, resource_id, action_id, $4::varchar, $5::varchar
            FROM target
          `,
          [resource.resourceKey, action.key, roleName, effect, scope]
        );
      }
    }
  }
}

async function main() {
  const host = process.env.DATABASE_HOST;
  const port = Number(process.env.DATABASE_PORT || 5432);
  const database = process.env.DATABASE_NAME;
  const sslEnabled = process.env.DATABASE_SSL === "true";

  console.log(
    `[e2e-permission-baseline] connect target host=${host || "(empty)"} port=${port} db=${database || "(empty)"} ssl=${sslEnabled}`
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
            rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
          }
        : false,
  });

  await client.connect();
  try {
    await client.query("BEGIN");
    await ensureActions(client);
    await ensureResources(client);
    await ensureRolePermissions(client);
    await client.query("COMMIT");
    console.log("[e2e-permission-baseline] baseline ensured");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[e2e-permission-baseline] failed:", formatConnectError(error));
  process.exit(1);
});
