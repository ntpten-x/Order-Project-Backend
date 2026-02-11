import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

function buildPgConfig() {
  return {
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 5432),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl:
      process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "1"
        ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true" }
        : undefined,
  };
}

function requireEnv(config) {
  const requiredKeys = ["host", "port", "user", "password", "database"];
  const missing = requiredKeys
    .filter((key) => {
      const value = config[key];
      return value === undefined || value === null || value === "";
    });
  if (missing.length > 0) {
    throw new Error(`Missing database config: ${missing.join(", ")}`);
  }
}

function parseStatuses() {
  const raw = process.env.PROFILE_STATUSES || "Pending,Cooking,Served,WaitingForPayment";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildWhereSql({ statuses, orderType, query, branchId }, params) {
  const where = [];

  if (statuses?.length) {
    params.push(statuses);
    where.push(`o.status::text = ANY($${params.length})`);
  }

  if (orderType) {
    params.push(orderType);
    where.push(`o.order_type::text = $${params.length}`);
  }

  if (query) {
    params.push(`${query}%`);
    const q = params.length;
    where.push(`(
      o.order_no ILIKE $${q}
      OR o.delivery_code ILIKE $${q}
      OR t.table_name ILIKE $${q}
      OR d.delivery_name ILIKE $${q}
    )`);
  }

  if (branchId) {
    params.push(branchId);
    where.push(`o.branch_id = $${params.length}`);
  }

  return where.length ? `WHERE ${where.join(" AND ")}` : "";
}

function buildOrdersSummaryDataQuery(whereSql, limitParamIndex, offsetParamIndex) {
  return `
    WITH base_orders AS (
      SELECT
        o.id,
        o.order_no,
        o.order_type,
        o.status,
        o.create_date,
        o.total_amount,
        o.delivery_code,
        o.table_id,
        o.delivery_id,
        t.table_name AS table_name,
        d.delivery_name AS delivery_name
      FROM sales_orders o
      LEFT JOIN tables t ON t.id = o.table_id
      LEFT JOIN delivery d ON d.id = o.delivery_id
      ${whereSql}
      ORDER BY o.create_date DESC
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    ),
    item_agg_raw AS (
      SELECT
        i.order_id,
        c.display_name AS category_name,
        SUM(i.quantity)::int AS qty
      FROM sales_order_item i
      INNER JOIN base_orders bo ON bo.id = i.order_id
      LEFT JOIN products p ON p.id = i.product_id
      LEFT JOIN category c ON c.id = p.category_id
      WHERE i.status::text NOT IN ('Cancelled', 'cancelled')
      GROUP BY i.order_id, c.display_name
    ),
    item_agg AS (
      SELECT
        order_id,
        jsonb_object_agg(category_name, qty) FILTER (WHERE category_name IS NOT NULL) AS items_summary,
        SUM(qty)::int AS items_count
      FROM item_agg_raw
      GROUP BY order_id
    )
    SELECT
      bo.id,
      bo.order_no,
      bo.order_type,
      bo.status,
      bo.create_date,
      bo.total_amount,
      bo.delivery_code,
      bo.table_id,
      bo.delivery_id,
      bo.table_name,
      bo.delivery_name,
      COALESCE(ia.items_summary, '{}'::jsonb) AS items_summary,
      COALESCE(ia.items_count, 0) AS items_count
    FROM base_orders bo
    LEFT JOIN item_agg ia ON ia.order_id = bo.id
    ORDER BY bo.create_date DESC
  `;
}

function toNumber(value) {
  return typeof value === "number" ? value : Number(value);
}

function extractPlanSummary(planRoot) {
  const root = Array.isArray(planRoot) ? planRoot[0] : planRoot;
  return {
    executionTimeMs: toNumber(root?.["Execution Time"] || 0),
    planningTimeMs: toNumber(root?.["Planning Time"] || 0),
    sharedHitBlocks: toNumber(root?.Plan?.["Shared Hit Blocks"] || 0),
    sharedReadBlocks: toNumber(root?.Plan?.["Shared Read Blocks"] || 0),
    planRows: toNumber(root?.Plan?.["Plan Rows"] || 0),
    actualRows: toNumber(root?.Plan?.["Actual Rows"] || 0),
    nodeType: root?.Plan?.["Node Type"] || "Unknown",
  };
}

async function explainAnalyze(client, name, text, values) {
  const sql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${text}`;
  const result = await client.query(sql, values);
  const planJson = result.rows?.[0]?.["QUERY PLAN"] || [];
  return {
    name,
    sql: text.trim(),
    params: values,
    summary: extractPlanSummary(planJson),
    plan: planJson,
  };
}

async function run() {
  const config = buildPgConfig();
  requireEnv(config);

  const client = new Client(config);
  await client.connect();

  const page = Number(process.env.PROFILE_PAGE || 1);
  const limit = Number(process.env.PROFILE_LIMIT || 50);
  const statuses = parseStatuses();
  const orderType = process.env.PROFILE_ORDER_TYPE || "";
  const query = process.env.PROFILE_QUERY || "";
  const branchId = process.env.PROFILE_BRANCH_ID || "";
  const startDate = process.env.PROFILE_START_DATE || "";
  const endDate = process.env.PROFILE_END_DATE || "";
  const topItemsLimit = Number(process.env.PROFILE_TOP_ITEMS_LIMIT || 10);

  const baseParams = [];
  const whereSql = buildWhereSql({ statuses, orderType, query, branchId }, baseParams);

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM sales_orders o
    LEFT JOIN tables t ON t.id = o.table_id
    LEFT JOIN delivery d ON d.id = o.delivery_id
    ${whereSql}
  `;

  const dataParams = [...baseParams, limit, (page - 1) * limit];
  const limitIndex = baseParams.length + 1;
  const offsetIndex = baseParams.length + 2;
  const dataQuery = buildOrdersSummaryDataQuery(whereSql, limitIndex, offsetIndex);

  const salesSummaryParams = [];
  const salesWhere = [];
  if (startDate && endDate) {
    salesSummaryParams.push(startDate, endDate);
    salesWhere.push(`date BETWEEN $1 AND $2`);
  }
  if (branchId) {
    salesSummaryParams.push(branchId);
    salesWhere.push(`branch_id = $${salesSummaryParams.length}`);
  }
  const salesSummaryQuery = `
    SELECT *
    FROM sales_summary_view
    ${salesWhere.length ? `WHERE ${salesWhere.join(" AND ")}` : ""}
    ORDER BY date DESC
  `;

  const topItemsParams = [];
  const topItemsWhere = [];
  if (branchId) {
    topItemsParams.push(branchId);
    topItemsWhere.push(`branch_id = $${topItemsParams.length}`);
  }
  topItemsParams.push(topItemsLimit);
  const topItemsQuery = `
    SELECT *
    FROM top_selling_items_view
    ${topItemsWhere.length ? `WHERE ${topItemsWhere.join(" AND ")}` : ""}
    ORDER BY total_quantity DESC
    LIMIT $${topItemsParams.length}
  `;

  const reports = [];
  try {
    reports.push(await explainAnalyze(client, "orders.summary.count", countQuery, baseParams));
    reports.push(await explainAnalyze(client, "orders.summary.data", dataQuery, dataParams));
    reports.push(await explainAnalyze(client, "dashboard.sales.summary", salesSummaryQuery, salesSummaryParams));
    reports.push(await explainAnalyze(client, "dashboard.top-items", topItemsQuery, topItemsParams));
  } finally {
    await client.end();
  }

  const outputDir = path.resolve(process.cwd(), process.env.QUERY_PROFILE_DIR || "query-plans");
  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFile = path.join(outputDir, `read-heavy-explain-${timestamp}.json`);
  const payload = {
    generatedAt: new Date().toISOString(),
    config: {
      page,
      limit,
      statuses,
      orderType: orderType || null,
      query: query || null,
      branchId: branchId || null,
      startDate: startDate || null,
      endDate: endDate || null,
      topItemsLimit,
    },
    reports,
  };
  await fs.writeFile(outputFile, JSON.stringify(payload, null, 2), "utf8");

  console.log(`[profile] saved ${outputFile}`);
  for (const report of reports) {
    const s = report.summary;
    console.log(
      `[profile] ${report.name} exec=${s.executionTimeMs.toFixed(2)}ms plan=${s.planningTimeMs.toFixed(2)}ms rows=${s.actualRows}/${s.planRows} node=${s.nodeType}`
    );
  }
}

run().catch((error) => {
  console.error(`[profile] failed: ${error.message}`);
  process.exit(1);
});
