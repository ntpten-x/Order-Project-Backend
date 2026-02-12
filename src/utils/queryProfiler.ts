import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getDbManager } from "../database/dbContext";

const enabled = process.env.QUERY_PROFILE_ENABLED === "true";
const slowMs = Number(process.env.QUERY_PROFILE_SLOW_MS || 250);
const explainEnabled = process.env.QUERY_PROFILE_EXPLAIN === "true";
const logDir = process.env.QUERY_PROFILE_DIR || "query-plans";
const sampleRate = Number(process.env.QUERY_PROFILE_SAMPLE_RATE || 1);

function shouldSample(): boolean {
    if (!enabled) return false;
    if (sampleRate >= 1) return true;
    return Math.random() < Math.max(0, sampleRate);
}

async function appendLogLine(line: string): Promise<void> {
    try {
        const targetDir = path.resolve(process.cwd(), logDir);
        await mkdir(targetDir, { recursive: true });
        const file = path.join(targetDir, "query-profile.log");
        await appendFile(file, `${new Date().toISOString()} ${line}\n`, "utf8");
    } catch {
        // non-blocking logging
    }
}

export async function executeProfiledQuery<T = any>(
    name: string,
    sql: string,
    params: unknown[] = []
): Promise<T[]> {
    const start = process.hrtime.bigint();
    const result = await getDbManager().query(sql, params);
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    if (shouldSample()) {
        const level = durationMs >= slowMs ? "SLOW" : "OK";
        const msg = `[QUERY_PROFILE][${level}] ${name} ${durationMs.toFixed(1)}ms`;
        console.log(msg);
        await appendLogLine(msg);

        if (explainEnabled && durationMs >= slowMs) {
            try {
                const plan = await getDbManager().query(`EXPLAIN (FORMAT JSON) ${sql}`, params);
                await appendLogLine(
                    `[QUERY_EXPLAIN] ${name} ${JSON.stringify(plan?.[0] ?? plan)}`
                );
            } catch (error) {
                await appendLogLine(`[QUERY_EXPLAIN_ERROR] ${name} ${String(error)}`);
            }
        }
    }

    return result as T[];
}

export async function logProfileDuration(name: string, durationMs: number): Promise<void> {
    if (!shouldSample()) return;
    const level = durationMs >= slowMs ? "SLOW" : "OK";
    const msg = `[QUERY_PROFILE][${level}] ${name} ${durationMs.toFixed(1)}ms`;
    console.log(msg);
    await appendLogLine(msg);
}
