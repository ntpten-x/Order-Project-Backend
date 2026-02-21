import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
const composeArgsBase = ["compose", "-f", "docker-compose.staging-test.yml", "--profile", "staging-test"];
const runFullTestSuite = process.argv.includes("--full-test");
const randomSuffix = randomBytes(12).toString("hex");
const stagingDbPassword = process.env.APP_DB_PASSWORD || "change-me-staging-db-password";
const stagingJwtSecret = process.env.JWT_SECRET || `staging-jwt-${randomSuffix}`;
const stagingAdminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || `staging-admin-${randomSuffix}`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio ?? "inherit",
      shell: options.shell ?? false,
      env: options.env ?? process.env,
      cwd: options.cwd ?? process.cwd(),
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed (exit ${code ?? 1})`));
    });
  });
}

async function runIfPossible(command, args, env) {
  try {
    await run(command, args, { env });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[staging-integration] non-fatal cleanup error: ${message}`);
  }
}

async function waitForService(name, args, env, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await run("docker", [...composeArgsBase, ...args], { stdio: "ignore", env });
      console.log(`[staging-integration] ${name} is ready`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`Timed out waiting for ${name}`);
}

async function runNpm(args, env) {
  await run("npm", args, { env, shell: process.platform === "win32" });
}

async function main() {
  const composeEnv = {
    ...process.env,
    APP_DB_PASSWORD: stagingDbPassword,
  };

  const gateEnv = {
    ...composeEnv,
    NODE_ENV: "development",
    DATABASE_HOST: "127.0.0.1",
    DATABASE_PORT: "55432",
    DATABASE_USER: "order_app",
    DATABASE_PASSWORD: stagingDbPassword,
    DATABASE_NAME: "order_project",
    DATABASE_SSL: "false",
    TYPEORM_SYNC: "false",
    ALLOW_TYPEORM_SYNC_WITH_NON_OWNER: "0",
    ENFORCE_DB_ROLE_POLICY: "1",
    ALLOW_SUPERUSER_DB_ROLE: "0",
    ALLOW_BYPASSRLS: "0",
    REDIS_URL: "redis://127.0.0.1:56379",
    RATE_LIMIT_REDIS_URL: "redis://127.0.0.1:56379",
    JWT_SECRET: stagingJwtSecret,
    RUN_RBAC_BASELINE_ON_START: "true",
    BOOTSTRAP_ADMIN_USERNAME: process.env.BOOTSTRAP_ADMIN_USERNAME || "admin",
    BOOTSTRAP_ADMIN_PASSWORD: stagingAdminPassword,
    BOOTSTRAP_ADMIN_NAME: process.env.BOOTSTRAP_ADMIN_NAME || "System Administrator",
  };
  const integrationTestEnv = {
    ...gateEnv,
    NODE_ENV: "test",
    TYPEORM_SYNC: "false",
    ALLOW_TYPEORM_SYNC_WITH_NON_OWNER: "0",
    REDIS_DISABLED: "true",
    REDIS_URL: "",
    RATE_LIMIT_REDIS_URL: "",
    PERMISSION_ADMIN_BYPASS: "false",
  };

  await runIfPossible("docker", [...composeArgsBase, "down", "-v", "--remove-orphans"], composeEnv);

  try {
    console.log("[staging-integration] starting postgres + redis (clean)");
    await run("docker", [...composeArgsBase, "up", "-d", "db", "redis"], { env: composeEnv });

    await waitForService(
      "postgres",
      ["exec", "-T", "db", "pg_isready", "-U", "postgres", "-d", "order_project"],
      composeEnv
    );
    await waitForService("redis", ["exec", "-T", "redis", "redis-cli", "ping"], composeEnv);

    console.log("[staging-integration] migrate + policy gates");
    await runNpm(["run", "security:db-role:check"], gateEnv);
    await runNpm(["run", "migration:run"], gateEnv);
    await runNpm(["run", "security:rbac:bootstrap"], gateEnv);
    await runNpm(["run", "env:check"], gateEnv);
    await runNpm(["run", "ensure:e2e-domain-baseline"], gateEnv);

    if (runFullTestSuite) {
      console.log("[staging-integration] running full backend test suite");
      await runNpm(["test"], integrationTestEnv);
    } else {
      console.log("[staging-integration] running integration + realtime contracts");
      await runNpm(["run", "test:integration:pos-flow"], integrationTestEnv);
      await runNpm(["run", "test:realtime:contract"], integrationTestEnv);
    }
  } finally {
    console.log("[staging-integration] stopping stack and removing volumes");
    await runIfPossible("docker", [...composeArgsBase, "down", "-v", "--remove-orphans"], composeEnv);
  }
}

main().catch((error) => {
  console.error(`[staging-integration] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
