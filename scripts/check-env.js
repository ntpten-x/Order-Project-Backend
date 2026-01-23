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

const bad = required.filter((k) => {
    const v = process.env[k];
    return !v || v.includes("<CHANGE_ME>");
});

if (bad.length) {
    console.error(`env:check failed. Please set real values for: ${bad.join(", ")}`);
    process.exit(1);
}

console.log("env:check ok");
