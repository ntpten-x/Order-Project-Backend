import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routesRoot = path.join(root, "src", "routes");

const methods = new Set(["get", "post", "put", "patch", "delete"]);
const routeMethodRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*(get|post|put|patch|delete)\s*\(/g;

const allowlist = new Set([
    "src/routes/auth.route.ts:post:/login",
    "src/routes/auth.route.ts:post:/logout",
    "src/routes/auth.route.ts:get:/me",
]);

function walkRouteFiles(dir, acc = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkRouteFiles(full, acc);
            continue;
        }
        if (entry.isFile() && entry.name.endsWith(".route.ts")) {
            acc.push(full);
        }
    }
    return acc;
}

function lineOfIndex(text, index) {
    let line = 1;
    for (let i = 0; i < index; i += 1) {
        if (text[i] === "\n") line += 1;
    }
    return line;
}

function extractCallArgs(text, openParenIndex) {
    let i = openParenIndex + 1;
    let depth = 1;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;

    while (i < text.length) {
        const ch = text[i];
        const prev = text[i - 1];

        if (!inDouble && !inTemplate && ch === "'" && prev !== "\\") {
            inSingle = !inSingle;
            i += 1;
            continue;
        }
        if (!inSingle && !inTemplate && ch === "\"" && prev !== "\\") {
            inDouble = !inDouble;
            i += 1;
            continue;
        }
        if (!inSingle && !inDouble && ch === "`" && prev !== "\\") {
            inTemplate = !inTemplate;
            i += 1;
            continue;
        }

        if (!inSingle && !inDouble && !inTemplate) {
            if (ch === "(") depth += 1;
            if (ch === ")") {
                depth -= 1;
                if (depth === 0) {
                    return text.slice(openParenIndex + 1, i);
                }
            }
        }

        i += 1;
    }

    return null;
}

function extractPathArg(argsText) {
    const trimmed = argsText.trimStart();
    const match = trimmed.match(/^(['"`])([^'"`]+)\1/);
    if (!match) return null;
    return match[2];
}

const files = walkRouteFiles(routesRoot);
let failed = false;

for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const source = fs.readFileSync(file, "utf8");

    if (source.includes("authorizeRole(")) {
        failed = true;
        console.error(`[route-guard] FAIL ${rel}: contains authorizeRole(...)`);
    }

    routeMethodRegex.lastIndex = 0;
    let match;
    while ((match = routeMethodRegex.exec(source)) !== null) {
        const method = match[2].toLowerCase();
        if (!methods.has(method)) continue;

        const openParenIndex = match.index + match[0].length - 1;
        const args = extractCallArgs(source, openParenIndex);
        if (!args) {
            failed = true;
            const line = lineOfIndex(source, match.index);
            console.error(`[route-guard] FAIL ${rel}:${line} unable to parse route call`);
            continue;
        }

        const routePath = extractPathArg(args);
        if (!routePath) {
            failed = true;
            const line = lineOfIndex(source, match.index);
            console.error(`[route-guard] FAIL ${rel}:${line} first route arg must be static path string`);
            continue;
        }

        const key = `${rel}:${method}:${routePath}`;
        if (allowlist.has(key)) {
            console.log(`[route-guard] PASS allowlist ${key}`);
            continue;
        }

        if (!args.includes("authorizePermission(")) {
            failed = true;
            const line = lineOfIndex(source, match.index);
            console.error(
                `[route-guard] FAIL ${rel}:${line} ${method.toUpperCase()} ${routePath} missing authorizePermission(...)`
            );
        }
    }
}

if (failed) {
    process.exit(1);
}

console.log("[route-guard] All route permission guard checks passed.");
