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
    resourceKey: "audit.page",
    resourceName: "Audit Logs",
    routePattern: "/audit",
    sortOrder: 191,
    policies: {
      Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
      Manager: { scope: "branch", access: "deny", view: "deny", create: "deny", update: "deny", delete: "deny" },
      Employee: { scope: "branch", access: "deny", view: "deny", create: "deny", update: "deny", delete: "deny" },
    },
  },
  {
    resourceKey: "health_system.page",
    resourceName: "Health System",
    routePattern: "/Health-System",
    sortOrder: 192,
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

        const roleRow = await client.query(
          `
            SELECT id
            FROM roles
            WHERE lower(roles_name) = lower($1)
            ORDER BY id ASC
            LIMIT 1
          `,
          [roleName]
        );
        const resourceRow = await client.query(
          `
            SELECT id
            FROM permission_resources
            WHERE resource_key = $1
            ORDER BY id ASC
            LIMIT 1
          `,
          [resource.resourceKey]
        );
        const actionRow = await client.query(
          `
            SELECT id
            FROM permission_actions
            WHERE action_key = $1
            ORDER BY id ASC
            LIMIT 1
          `,
          [action.key]
        );

        const roleId = roleRow.rows?.[0]?.id;
        const resourceId = resourceRow.rows?.[0]?.id;
        const actionId = actionRow.rows?.[0]?.id;
        if (!roleId || !resourceId || !actionId) {
          continue;
        }

        await client.query(
          `
            INSERT INTO role_permissions (role_id, resource_id, action_id, effect, scope)
            VALUES ($1, $2, $3, $4::varchar, $5::varchar)
            ON CONFLICT (role_id, resource_id, action_id)
            DO UPDATE SET
              effect = EXCLUDED.effect,
              scope = EXCLUDED.scope,
              updated_at = now()
          `,
          [roleId, resourceId, actionId, effect, scope]
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
