import { spawnSync } from "node:child_process";

const maxSeconds = Number(process.env.TSC_PERF_MAX_SECONDS || 20);
const result = spawnSync(
    "npx",
    ["tsc", "--noEmit", "--extendedDiagnostics", "-p", "tsconfig.fast.json"],
    { encoding: "utf8", shell: true }
);

const output = `${result.stdout || ""}\n${result.stderr || ""}`;
const match = output.match(/Total time:\s*([0-9.]+)s/i);
const totalSeconds = match ? Number(match[1]) : NaN;

if (result.status !== 0) {
    process.stdout.write(output);
    process.exit(result.status ?? 1);
}

if (!Number.isFinite(totalSeconds)) {
    console.error("[perf-guard] Unable to parse TypeScript total time.");
    process.stdout.write(output);
    process.exit(2);
}

console.log(`[perf-guard] tsc total=${totalSeconds.toFixed(2)}s max=${maxSeconds.toFixed(2)}s`);
if (totalSeconds > maxSeconds) {
    console.error("[perf-guard] TypeScript compile regression detected.");
    process.exit(1);
}

console.log("[perf-guard] Compile time within threshold.");
