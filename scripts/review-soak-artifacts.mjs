import fs from "node:fs/promises";
import path from "node:path";

const artifactDirArg = process.argv[2] || process.env.SOAK_ARTIFACT_DIR;
if (!artifactDirArg) {
  console.error("[soak-review] usage: node scripts/review-soak-artifacts.mjs <artifact-dir>");
  process.exit(1);
}

const artifactDir = path.resolve(artifactDirArg);
const summaryPath = path.join(artifactDir, "k6-summary.json");
const k6LogPath = path.join(artifactDir, "k6.log");
const apiLogPath = path.join(artifactDir, "api.log");
const errorLogPath = path.join(artifactDir, "error.log");
const reportPath = path.join(artifactDir, "review-report.md");

const MAX_ERROR_RATE = Number(process.env.SOAK_MAX_ERROR_RATE ?? 0.02);
const MAX_P95_MS = Number(process.env.SOAK_MAX_P95_MS ?? 250);
const MAX_P99_MS = Number(process.env.SOAK_MAX_P99_MS ?? 1000);
const MAX_TIMEOUTS = Number(process.env.SOAK_MAX_TIMEOUTS ?? 0);
const MAX_5XX = Number(process.env.SOAK_MAX_5XX ?? 0);

const readTextOrEmpty = async (filePath) => {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
};

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getMetricValue = (summary, metricName, keyName) => {
  const metric = summary?.metrics?.[metricName];
  const values = metric?.values;
  if (!values || typeof values !== "object") return 0;
  if (keyName in values) return parseNumber(values[keyName], 0);
  return 0;
};

const countMatches = (text, pattern) => {
  if (!text) return 0;
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
};

const count5xxFromLog = (text) => {
  if (!text) return 0;
  // Handles typical access logs such as "GET /path 500" and JSON logs with "status":500.
  return (
    countMatches(text, /\bstatus["=: ]+5\d\d\b/g) +
    countMatches(text, /\s5\d\d\s/g)
  );
};

const formatPct = (value) => `${(value * 100).toFixed(2)}%`;
const formatMs = (value) => `${value.toFixed(2)}ms`;

async function main() {
  let summary;
  try {
    const summaryRaw = await fs.readFile(summaryPath, "utf8");
    summary = JSON.parse(summaryRaw);
  } catch (error) {
    console.error(`[soak-review] cannot read k6 summary: ${summaryPath}`);
    console.error(error);
    process.exit(1);
  }

  const k6Log = await readTextOrEmpty(k6LogPath);
  const apiLog = await readTextOrEmpty(apiLogPath);
  const errorLog = await readTextOrEmpty(errorLogPath);

  const errorRate = getMetricValue(summary, "http_req_failed", "rate");
  const p95 = getMetricValue(summary, "http_req_duration", "p(95)");
  const p99 = getMetricValue(summary, "http_req_duration", "p(99)");
  const maxDuration = getMetricValue(summary, "http_req_duration", "max");
  const totalReq = parseNumber(getMetricValue(summary, "http_reqs", "count"), 0);

  const timeoutCount =
    countMatches(k6Log, /timeout/gi) +
    countMatches(k6Log, /timed out/gi) +
    countMatches(k6Log, /context deadline exceeded/gi) +
    countMatches(k6Log, /request failed/gi);

  const api5xxCount = count5xxFromLog(apiLog) + count5xxFromLog(errorLog);

  const checks = [
    {
      id: "error_rate",
      pass: errorRate <= MAX_ERROR_RATE,
      actual: formatPct(errorRate),
      budget: `<= ${formatPct(MAX_ERROR_RATE)}`,
    },
    {
      id: "p95",
      pass: p95 <= MAX_P95_MS,
      actual: formatMs(p95),
      budget: `<= ${formatMs(MAX_P95_MS)}`,
    },
    {
      id: "p99",
      pass: p99 <= MAX_P99_MS,
      actual: formatMs(p99),
      budget: `<= ${formatMs(MAX_P99_MS)}`,
    },
    {
      id: "timeouts",
      pass: timeoutCount <= MAX_TIMEOUTS,
      actual: String(timeoutCount),
      budget: `<= ${MAX_TIMEOUTS}`,
    },
    {
      id: "5xx",
      pass: api5xxCount <= MAX_5XX,
      actual: String(api5xxCount),
      budget: `<= ${MAX_5XX}`,
    },
  ];

  const passAll = checks.every((c) => c.pass);
  const lines = [];
  lines.push("# Soak Review Report");
  lines.push("");
  lines.push(`- Artifact dir: \`${artifactDir}\``);
  lines.push(`- Status: **${passAll ? "PASS" : "FAIL"}**`);
  lines.push(`- Total requests: ${totalReq}`);
  lines.push(`- Max duration: ${formatMs(maxDuration)}`);
  lines.push("");
  lines.push("| Check | Actual | Budget | Result |");
  lines.push("| --- | --- | --- | --- |");
  for (const check of checks) {
    lines.push(`| ${check.id} | ${check.actual} | ${check.budget} | ${check.pass ? "PASS" : "FAIL"} |`);
  }
  lines.push("");
  lines.push("## Inputs");
  lines.push("");
  lines.push(`- k6 summary: \`${summaryPath}\``);
  lines.push(`- k6 log: \`${k6LogPath}\`${k6Log ? "" : " (not found)"}`);
  lines.push(`- api log: \`${apiLogPath}\`${apiLog ? "" : " (not found)"}`);
  lines.push(`- error log: \`${errorLogPath}\`${errorLog ? "" : " (not found)"}`);

  await fs.writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`[soak-review] report written: ${reportPath}`);
  console.log(`[soak-review] status: ${passAll ? "PASS" : "FAIL"}`);

  process.exit(passAll ? 0 : 2);
}

main().catch((error) => {
  console.error("[soak-review] failed:", error);
  process.exit(1);
});
