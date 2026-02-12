import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const checks = [
    {
        label: "A2 private-swr headers on POS master GET controllers",
        files: [
            "src/controllers/pos/category.controller.ts",
            "src/controllers/pos/products.controller.ts",
            "src/controllers/pos/tables.controller.ts",
            "src/controllers/pos/delivery.controller.ts",
            "src/controllers/pos/discounts.controller.ts",
            "src/controllers/pos/paymentMethod.controller.ts",
            "src/controllers/pos/productsUnit.controller.ts",
        ],
        pattern: /setPrivateSwrHeaders\(res\)/g,
        minMatchesPerFile: 1,
    },
    {
        label: "A3 no-store headers on admin read controllers",
        files: [
            "src/controllers/users.controller.ts",
            "src/controllers/roles.controller.ts",
            "src/controllers/branch.controller.ts",
            "src/controllers/audit.controller.ts",
        ],
        pattern: /setNoStoreHeaders\(res\)/g,
        minMatchesPerFile: 1,
    },
    {
        label: "A1 no-store headers on auth endpoints",
        files: ["src/controllers/auth.controller.ts"],
        pattern: /setNoStoreHeaders\(res\)/g,
        minMatchesPerFile: 4,
    },
    {
        label: "A4+A5 no-store headers on /csrf-token and /metrics",
        files: ["app.ts"],
        pattern: /setNoStoreHeaders\(res\)/g,
        minMatchesPerFile: 2,
    },
];

let failed = false;

for (const check of checks) {
    for (const file of check.files) {
        const abs = path.join(root, file);
        if (!fs.existsSync(abs)) {
            failed = true;
            console.error(`[policy-guard] FAIL missing file: ${file}`);
            continue;
        }
        const text = fs.readFileSync(abs, "utf8");
        const matches = text.match(check.pattern);
        const count = matches ? matches.length : 0;
        if (count < check.minMatchesPerFile) {
            failed = true;
            console.error(
                `[policy-guard] FAIL ${check.label} file=${file} matches=${count} expected>=${check.minMatchesPerFile}`
            );
        } else {
            console.log(
                `[policy-guard] PASS ${check.label} file=${file} matches=${count}`
            );
        }
    }
}

const reportPath = path.resolve(root, "..", "GO_LIVE_SIGNOFF_REPORT.md");
if (!fs.existsSync(reportPath)) {
    failed = true;
    console.error("[policy-guard] FAIL missing GO_LIVE_SIGNOFF_REPORT.md");
} else {
    const report = fs.readFileSync(reportPath, "utf8");
    if (report.includes("| Planned |")) {
        failed = true;
        console.error("[policy-guard] FAIL report still contains Planned status rows");
    } else {
        console.log("[policy-guard] PASS report has no Planned status rows");
    }
}

if (failed) {
    process.exit(1);
}

console.log("[policy-guard] All policy checks passed.");
