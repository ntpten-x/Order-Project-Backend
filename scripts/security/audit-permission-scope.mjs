import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routesRoot = path.join(root, "src", "routes");
const outputPath = path.join(root, "logs", "permission-scope-audit.md");

const routeMethodRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*(get|post|put|patch|delete)\s*\(/g;
const permissionRegex = /authorizePermission\(\s*["'`]([^"'`]+)["'`]\s*,\s*["'`]([^"'`]+)["'`]\s*\)/;

const criticalScopeRules = [
  {
    resource: "users.page",
    actions: new Set(["view", "update", "delete"]),
    pathPattern: /^\/:id$/,
    requiredMiddleware: "enforceUserTargetScope",
    filePattern: /src\/routes\/users\.route\.ts$/,
  },
  {
    resource: "orders.page",
    actions: new Set(["view", "update", "delete"]),
    pathPattern: /^\/:id$/,
    requiredMiddleware: "enforceOrderTargetScope",
    filePattern: /src\/routes\/pos\/orders\.route\.ts$/,
  },
  {
    resource: "orders.page",
    actions: new Set(["update", "delete"]),
    pathPattern: /^\/items\/:itemId$/,
    requiredMiddleware: "enforceOrderItemTargetScope",
    filePattern: /src\/routes\/pos\/orders\.route\.ts$/,
  },
  {
    resource: "orders.page",
    actions: new Set(["update"]),
    pathPattern: /^\/items\/:id\/status$/,
    requiredMiddleware: "enforceOrderItemTargetScope",
    filePattern: /src\/routes\/pos\/orders\.route\.ts$/,
  },
  {
    resource: "permissions.page",
    actions: new Set(["view", "update"]),
    pathPattern: /^\/users\/:id(\/effective)?$/,
    requiredMiddleware: "enforceUserTargetScope",
    filePattern: /src\/routes\/permissions\.route\.ts$/,
  },
  {
    resource: "permissions.page",
    actions: new Set(["view"]),
    pathPattern: /^\/roles\/:id\/effective$/,
    requiredMiddleware: "enforceAllScopeOnly",
    filePattern: /src\/routes\/permissions\.route\.ts$/,
  },
  {
    resource: "permissions.page",
    actions: new Set(["update"]),
    pathPattern: /^\/approvals\/:id\/(approve|reject)$/,
    requiredMiddleware: "enforceAllScopeOnly",
    filePattern: /src\/routes\/permissions\.route\.ts$/,
  },
  {
    resource: "roles.page",
    actions: new Set(["view", "update", "delete"]),
    pathPattern: /^\/:id$/,
    requiredMiddleware: "enforceAllScopeOnly",
    filePattern: /src\/routes\/roles\.route\.ts$/,
  },
  {
    resource: "branches.page",
    actions: new Set(["view", "update", "delete"]),
    pathPattern: /^\/:id$/,
    requiredMiddleware: "enforceBranchTargetScope",
    filePattern: /src\/routes\/branch\.route\.ts$/,
  },
  {
    resource: "audit.page",
    actions: new Set(["view"]),
    pathPattern: /^\/logs\/:id$/,
    requiredMiddleware: "enforceAuditLogTargetScope",
    filePattern: /src\/routes\/audit\.route\.ts$/,
  },
];

function walk(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".route.ts")) {
      acc.push(full);
    }
  }
  return acc;
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

function lineOfIndex(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text[i] === "\n") line += 1;
  }
  return line;
}

const files = walk(routesRoot);
const missingCritical = [];
const advisoryMissingScope = [];
const advisoryCoveredByBranchGuard = [];
const coveredCritical = [];

for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const source = fs.readFileSync(file, "utf8");
  const hasRequireBranchGuard = /\.\s*use\(\s*requireBranch\s*\)/.test(source);
  routeMethodRegex.lastIndex = 0;

  let match;
  while ((match = routeMethodRegex.exec(source)) !== null) {
    const method = match[2].toUpperCase();
    const openParenIndex = match.index + match[0].length - 1;
    const args = extractCallArgs(source, openParenIndex);
    if (!args) continue;
    const routePath = extractPathArg(args);
    if (!routePath) continue;

    const permissionMatch = args.match(permissionRegex);
    if (!permissionMatch) continue;

    const resource = permissionMatch[1];
    const action = permissionMatch[2];
    const hasScopeMiddleware =
      /enforce[A-Za-z0-9_]*Scope\(/.test(args) || args.includes("enforceAllScopeOnly(");
    const line = lineOfIndex(source, match.index);

    const criticalRule = criticalScopeRules.find(
      (rule) =>
        rule.resource === resource &&
        rule.actions.has(action) &&
        rule.pathPattern.test(routePath) &&
        rule.filePattern.test(rel)
    );

    if (criticalRule) {
      const hasRequired = args.includes(`${criticalRule.requiredMiddleware}(`);
      if (!hasRequired) {
        missingCritical.push({
          file: rel,
          line,
          method,
          routePath,
          resource,
          action,
          requiredMiddleware: criticalRule.requiredMiddleware,
        });
      } else {
        coveredCritical.push({
          file: rel,
          method,
          routePath,
          resource,
          action,
          middleware: criticalRule.requiredMiddleware,
        });
      }
      continue;
    }

    const mightNeedScope =
      /:id\b|:itemId\b|:userId\b/.test(routePath) &&
      ["view", "update", "delete"].includes(action);

    if (mightNeedScope && !hasScopeMiddleware) {
      if (hasRequireBranchGuard) {
        advisoryCoveredByBranchGuard.push({
          file: rel,
          line,
          method,
          routePath,
          resource,
          action,
        });
        continue;
      }

      advisoryMissingScope.push({
        file: rel,
        line,
        method,
        routePath,
        resource,
        action,
      });
    }
  }
}

const reportLines = [
  "# Permission Scope Audit",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "## Critical Rules Coverage",
  "",
  `- Covered critical routes: ${coveredCritical.length}`,
  `- Missing critical routes: ${missingCritical.length}`,
  "",
  "## Missing Critical Scope Middleware",
  "",
];

if (missingCritical.length === 0) {
  reportLines.push("_None_");
} else {
  for (const row of missingCritical) {
    reportLines.push(
      `- ${row.file}:${row.line} ${row.method} ${row.routePath} (${row.resource}:${row.action}) missing ${row.requiredMiddleware}`
    );
  }
}

reportLines.push("", "## Advisory Routes Without Scope Middleware", "");

if (advisoryMissingScope.length === 0) {
  reportLines.push("_None_");
} else {
  for (const row of advisoryMissingScope) {
    reportLines.push(
      `- ${row.file}:${row.line} ${row.method} ${row.routePath} (${row.resource}:${row.action})`
    );
  }
}

reportLines.push("", "## Advisory Routes Covered By requireBranch Guard", "");

if (advisoryCoveredByBranchGuard.length === 0) {
  reportLines.push("_None_");
} else {
  for (const row of advisoryCoveredByBranchGuard) {
    reportLines.push(
      `- ${row.file}:${row.line} ${row.method} ${row.routePath} (${row.resource}:${row.action})`
    );
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, reportLines.join("\n"), "utf8");

console.log(`[scope-audit] report: ${path.relative(root, outputPath)}`);
console.log(
  `[scope-audit] critical_covered=${coveredCritical.length} critical_missing=${missingCritical.length} advisory_missing=${advisoryMissingScope.length} advisory_covered_by_branch_guard=${advisoryCoveredByBranchGuard.length}`
);

if (missingCritical.length > 0) {
  process.exit(1);
}
