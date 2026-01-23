/* CI-friendly migration runner.
 * Skips automatically unless CI_MIGRATION=1 and required DB envs are present.
 */
require("dotenv").config();
const { spawnSync } = require("child_process");

const required = ["DATABASE_HOST", "DATABASE_PORT", "DATABASE_USER", "DATABASE_PASSWORD", "DATABASE_NAME"];
const missing = required.filter((k) => !process.env[k] || process.env[k].includes("<CHANGE_ME>"));

if (process.env.CI_MIGRATION !== "1") {
    console.log("ci-migrate: CI_MIGRATION not set; skipping database migrations.");
    process.exit(0);
}

if (missing.length) {
    console.warn(`ci-migrate: missing env vars (${missing.join(", ")}). Skipping migration run.`);
    process.exit(0);
}

const result = spawnSync("npm", ["run", "migration:run"], { stdio: "inherit", shell: true });
process.exit(result.status || 0);
