import fs from "node:fs/promises";
import path from "node:path";

function usageAndExit() {
  console.error(
    "[soak-compare] usage: node scripts/compare-soak-artifacts.mjs <baseline-artifact-dir> <candidate-artifact-dir>"
  );
  process.exit(1);
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getMetricValue(summary, metricName, keyName) {
  const metric = summary?.metrics?.[metricName];
  const values = metric?.values;
  if (!values || typeof values !== "object") return 0;
  if (!(keyName in values)) return 0;
  return parseNumber(values[keyName], 0);
}

function formatMs(value) {
  return `${value.toFixed(2)}ms`;
}

function formatPct(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatDelta(value, formatter) {
  if (value === 0) return `${formatter(0)} (no change)`;
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatter(value)}`;
}

async function readSummary(artifactDir) {
  const resolvedDir = path.resolve(artifactDir);
  const summaryPath = path.join(resolvedDir, "k6-summary.json");
  const raw = await fs.readFile(summaryPath, "utf8");
  const summary = JSON.parse(raw);
  return {
    artifactDir: resolvedDir,
    summaryPath,
    p95: getMetricValue(summary, "http_req_duration", "p(95)"),
    p99: getMetricValue(summary, "http_req_duration", "p(99)"),
    errorRate: getMetricValue(summary, "http_req_failed", "rate"),
    totalRequests: getMetricValue(summary, "http_reqs", "count"),
  };
}

async function main() {
  const baselineArg = process.argv[2];
  const candidateArg = process.argv[3];
  if (!baselineArg || !candidateArg) usageAndExit();

  const baseline = await readSummary(baselineArg);
  const candidate = await readSummary(candidateArg);

  const p95Delta = candidate.p95 - baseline.p95;
  const p99Delta = candidate.p99 - baseline.p99;
  const errorRateDelta = candidate.errorRate - baseline.errorRate;

  const lines = [
    "# Soak Comparison",
    "",
    `- Baseline: \`${baseline.artifactDir}\``,
    `- Candidate: \`${candidate.artifactDir}\``,
    "",
    "| Metric | Baseline | Candidate | Delta |",
    "| --- | --- | --- | --- |",
    `| p95 latency | ${formatMs(baseline.p95)} | ${formatMs(candidate.p95)} | ${formatDelta(p95Delta, formatMs)} |`,
    `| p99 latency | ${formatMs(baseline.p99)} | ${formatMs(candidate.p99)} | ${formatDelta(p99Delta, formatMs)} |`,
    `| error rate | ${formatPct(baseline.errorRate)} | ${formatPct(candidate.errorRate)} | ${formatDelta(errorRateDelta, formatPct)} |`,
    `| request count | ${baseline.totalRequests} | ${candidate.totalRequests} | ${Math.round(
      candidate.totalRequests - baseline.totalRequests
    )} |`,
    "",
  ];

  const improvedP95 = p95Delta <= 0;
  const improvedP99 = p99Delta <= 0;
  const improvedErrorRate = errorRateDelta <= 0;
  const overall = improvedP95 && improvedP99 && improvedErrorRate ? "IMPROVED_OR_EQUAL" : "REGRESSION_DETECTED";
  lines.push(`Result: **${overall}**`);

  const reportPath = path.join(candidate.artifactDir, "comparison-report.md");
  await fs.writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");

  console.log(lines.join("\n"));
  console.log(`\n[soak-compare] report written: ${reportPath}`);

  if (overall === "REGRESSION_DETECTED") process.exit(2);
}

main().catch((error) => {
  console.error("[soak-compare] failed:", error);
  process.exit(1);
});

