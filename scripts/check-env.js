/**
 * Basic env sanity check to avoid running with placeholder/missing secrets.
 * Exits 1 if critical values are missing or unchanged from <CHANGE_ME>.
 */
require("dotenv").config();

const required = [
    "DATABASE_HOST",
    "DATABASE_PORT",
    "DATABASE_USER",
    "DATABASE_PASSWORD",
    "DATABASE_NAME",
    "JWT_SECRET"
];

const hasPlaceholderValue = (value) => {
    if (!value) return true;
    const normalized = String(value).trim().toLowerCase();
    return (
        normalized.includes("<change_me") ||
        normalized.includes("<change-me") ||
        normalized.includes("change_me") ||
        normalized.includes("change-me")
    );
};

const bad = required.filter((k) => {
    const v = process.env[k];
    return hasPlaceholderValue(v);
});

if (bad.length) {
    console.error(`env:check failed. Please set real values for: ${bad.join(", ")}`);
    process.exit(1);
}

const dbUser = String(process.env.DATABASE_USER || "").trim().toLowerCase();
if (dbUser === "postgres") {
    console.error("env:check failed. DATABASE_USER=postgres is not allowed for runtime. Use a dedicated app role.");
    process.exit(1);
}

if (process.env.ENFORCE_DB_ROLE_POLICY === "0") {
    console.error("env:check failed. ENFORCE_DB_ROLE_POLICY must remain enabled.");
    process.exit(1);
}

if (process.env.ALLOW_SUPERUSER_DB_ROLE === "1" || process.env.ALLOW_BYPASSRLS === "1") {
    console.error("env:check failed. ALLOW_SUPERUSER_DB_ROLE/ALLOW_BYPASSRLS must not be enabled in governed environments.");
    process.exit(1);
}

const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
if (isProduction && process.env.TYPEORM_SYNC === "true") {
    console.error("env:check failed. TYPEORM_SYNC=true is not allowed in production. Use migrations only.");
    process.exit(1);
}

if (isProduction && process.env.METRICS_ENABLED === "true" && hasPlaceholderValue(process.env.METRICS_API_KEY)) {
    console.error("env:check failed. METRICS_API_KEY is required when METRICS_ENABLED=true in production.");
    process.exit(1);
}

const rateLimitRedisUrl = process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL || "";
if (isProduction && (process.env.RATE_LIMIT_REDIS_DISABLED === "true" || !rateLimitRedisUrl)) {
    console.error("env:check failed. RATE_LIMIT_REDIS_URL (or REDIS_URL) is required and cannot be disabled in production.");
    process.exit(1);
}

console.log("env:check ok");
