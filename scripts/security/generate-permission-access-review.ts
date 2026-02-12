import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Pool } from "pg";

type CliOptions = {
    days: number;
    output?: string;
    failOnStale: boolean;
    maxStale: number;
};

function parseArgs(argv: string[]): CliOptions {
    const envMaxStale = Number(process.env.ACCESS_REVIEW_MAX_STALE ?? 0);
    const opts: CliOptions = {
        days: 90,
        failOnStale: false,
        maxStale: Number.isFinite(envMaxStale) && envMaxStale >= 0 ? Math.floor(envMaxStale) : 0,
    };
    for (const arg of argv) {
        if (arg.startsWith("--days=")) {
            const days = Number(arg.slice("--days=".length));
            if (Number.isFinite(days) && days > 0) {
                opts.days = Math.floor(days);
            }
        }
        if (arg.startsWith("--output=")) {
            opts.output = arg.slice("--output=".length).trim();
        }
        if (arg === "--fail-on-stale") {
            opts.failOnStale = true;
        }
        if (arg.startsWith("--max-stale=")) {
            const maxStale = Number(arg.slice("--max-stale=".length));
            if (Number.isFinite(maxStale) && maxStale >= 0) {
                opts.maxStale = Math.floor(maxStale);
            }
        }
    }
    return opts;
}

function formatDateStamp(date = new Date()): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}${m}${d}`;
}

function toMarkdownTable(rows: Array<Record<string, unknown>>): string {
    if (!rows.length) return "_None_";
    const headers = Object.keys(rows[0]);
    const head = `| ${headers.join(" | ")} |`;
    const sep = `| ${headers.map(() => "---").join(" | ")} |`;
    const body = rows.map((row) => `| ${headers.map((h) => String(row[h] ?? "")).join(" | ")} |`).join("\n");
    return [head, sep, body].join("\n");
}

function getPoolConfig(): Record<string, unknown> {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (connectionString) {
        return { connectionString };
    }

    const host = process.env.DATABASE_HOST?.trim();
    const port = Number(process.env.DATABASE_PORT || "5432");
    const user = process.env.DATABASE_USER?.trim();
    const password = process.env.DATABASE_PASSWORD ?? "";
    const database = process.env.DATABASE_NAME?.trim();

    if (!host || !user || !database) {
        throw new Error(
            "DATABASE_URL is required, or set DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME"
        );
    }

    const useSsl = process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "1";
    const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true";

    return {
        host,
        port,
        user,
        password,
        database,
        ...(useSsl ? { ssl: { rejectUnauthorized } } : {}),
    };
}

async function main() {
    const options = parseArgs(process.argv.slice(2));

    const pool = new Pool(getPoolConfig());
    const client = await pool.connect();

    try {
        const summaryResult = await client.query(
            `
                SELECT
                    COUNT(*)::int AS total_users,
                    COUNT(*) FILTER (WHERE u.is_use = false)::int AS disabled_users,
                    COUNT(*) FILTER (WHERE lower(r.roles_name) = 'admin')::int AS admins
                FROM users u
                LEFT JOIN roles r ON r.id = u.roles_id
            `
        );

        const overrideSummaryResult = await client.query(
            `
                SELECT
                    u.id,
                    u.username,
                    COALESCE(u.name, '') AS name,
                    COALESCE(r.roles_name, '') AS role_name,
                    u.is_use,
                    COUNT(up.id)::int AS override_count,
                    COUNT(*) FILTER (
                        WHERE up.effect = 'allow'
                          AND pa.action_key = 'delete'
                    )::int AS delete_grants,
                    COUNT(*) FILTER (
                        WHERE up.effect = 'allow'
                          AND up.scope = 'all'
                    )::int AS global_scope_grants
                FROM users u
                LEFT JOIN roles r ON r.id = u.roles_id
                LEFT JOIN user_permissions up ON up.user_id = u.id
                LEFT JOIN permission_actions pa ON pa.id = up.action_id
                GROUP BY u.id, u.username, u.name, r.roles_name, u.is_use
                HAVING COUNT(up.id) > 0
                ORDER BY override_count DESC, username ASC
            `
        );

        const disabledWithOverridesResult = await client.query(
            `
                SELECT
                    u.id,
                    u.username,
                    COUNT(up.id)::int AS override_count
                FROM users u
                INNER JOIN user_permissions up ON up.user_id = u.id
                WHERE u.is_use = false
                GROUP BY u.id, u.username
                ORDER BY override_count DESC, username ASC
            `
        );

        const recentAuditsResult = await client.query(
            `
                SELECT
                    created_at,
                    actor_user_id,
                    target_type,
                    target_id,
                    action_type,
                    COALESCE(reason, '') AS reason
                FROM permission_audits
                WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
                ORDER BY created_at DESC
                LIMIT 200
            `,
            [options.days]
        );

        const staleReviewResult = await client.query(
            `
                SELECT
                    u.id,
                    u.username,
                    COUNT(up.id)::int AS override_count,
                    COALESCE(MAX(pa.created_at), MIN(up.updated_at), MIN(up.created_at)) AS last_change_at
                FROM users u
                INNER JOIN user_permissions up ON up.user_id = u.id
                LEFT JOIN permission_audits pa
                    ON pa.target_type = 'user'
                   AND pa.target_id = u.id
                   AND pa.action_type IN ('update_overrides', 'offboarding_revoke')
                GROUP BY u.id, u.username
                HAVING COALESCE(MAX(pa.created_at), MIN(up.updated_at), MIN(up.created_at)) < NOW() - ($1::int * INTERVAL '1 day')
                ORDER BY last_change_at ASC
            `,
            [options.days]
        );

        const summary = summaryResult.rows?.[0] ?? {
            total_users: 0,
            disabled_users: 0,
            admins: 0,
        };

        const generatedAt = new Date().toISOString();
        const outputPath = options.output || join("logs", `permission-access-review-${formatDateStamp()}.md`);
        mkdirSync(dirname(outputPath), { recursive: true });
        const staleCount = staleReviewResult.rows.length;
        const staleViolation = options.failOnStale && staleCount > options.maxStale;

        const markdown = [
            "# Permission Access Review",
            "",
            `- Generated at: ${generatedAt}`,
            `- Review window: last ${options.days} days`,
            `- Stale policy: ${options.failOnStale ? `enforced (max ${options.maxStale})` : "report-only"}`,
            "",
            "## Summary",
            "",
            `- Total users: ${summary.total_users}`,
            `- Admin users: ${summary.admins}`,
            `- Disabled users: ${summary.disabled_users}`,
            `- Users with overrides: ${overrideSummaryResult.rows.length}`,
            `- Disabled users with overrides: ${disabledWithOverridesResult.rows.length}`,
            `- Stale override reviews: ${staleCount}`,
            `- Policy result: ${staleViolation ? "FAILED" : "PASS"}`,
            "",
            "## Disabled Users With Overrides",
            "",
            toMarkdownTable(disabledWithOverridesResult.rows),
            "",
            "## Override Risk Summary",
            "",
            toMarkdownTable(overrideSummaryResult.rows),
            "",
            `## Recent Permission Audits (last ${options.days} days)`,
            "",
            toMarkdownTable(recentAuditsResult.rows),
            "",
            `## Stale Override Reviews (older than ${options.days} days)`,
            "",
            toMarkdownTable(staleReviewResult.rows),
            "",
            "## Follow-up Checklist",
            "",
            "- Revoke overrides for disabled users immediately.",
            "- Confirm high-risk grants (`delete_grants` and `global_scope_grants`) still required.",
            "- Schedule owner approval for stale overrides.",
            "- Attach this report to quarterly access review evidence.",
            "",
        ].join("\n");

        writeFileSync(outputPath, markdown, "utf8");
        console.log(`Access review report generated: ${outputPath}`);

        if (staleViolation) {
            throw new Error(
                `[access-review] stale policy violation: found ${staleCount} stale overrides (max allowed ${options.maxStale})`
            );
        }
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((error) => {
    console.error("[access-review] failed:", error);
    process.exitCode = 1;
});
